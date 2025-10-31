"""View classes for web annotation."""
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any, cast

import magic
from dae.annotation.annotatable import VCFAllele
from dae.annotation.annotation_config import (
    AnnotationConfigParser,
    AnnotationConfigurationError,
    AttributeInfo,
)
from dae.annotation.gene_score_annotator import GeneScoreAnnotator
from dae.annotation.score_annotator import GenomicScoreAnnotatorBase
from dae.annotation.annotation_factory import load_pipeline_from_grr
from dae.annotation.annotation_pipeline import AnnotationPipeline, Annotator
from dae.gene_scores.gene_scores import (
    build_gene_score_from_resource,
    _build_gene_score_help,
)
from dae.genomic_resources.genomic_scores import build_score_from_resource
from dae.genomic_resources.histogram import (
    Histogram,
    NullHistogram,
    NullHistogramConfig,
)
from dae.genomic_resources.implementations.annotation_pipeline_impl import (
    AnnotationPipelineImplementation,
)
from dae.genomic_resources.repository import \
    GenomicResource, GenomicResourceRepo
from dae.genomic_resources.repository_factory import \
    build_genomic_resource_repository
from dae.genomic_scores.scores import _build_score_help
from django import forms
from django.conf import settings
from django.contrib.auth import (
    authenticate,
    get_user_model,
    login,
    logout,
)
from django.core.files.uploadedfile import UploadedFile
from django.db.models import ObjectDoesNotExist, QuerySet
from django.http import HttpRequest
from django.http.response import (
    FileResponse,
    HttpResponse,
    HttpResponseRedirect,
)
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.http import last_modified
from pysam import VariantFile
from rest_framework import generics, permissions, views
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.request import Request, QueryDict, MultiValueDict
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from web_annotation.annotate_helpers import columns_file_preview, extract_head

from .models import (
    AccountConfirmationCode,
    BaseVerificationCode,
    Job,
    ResetPasswordCode,
    User,
)
from .permissions import has_job_permission
from .serializers import JobSerializer, UserSerializer
from .tasks import (
    annotate_vcf_job,
    annotate_columns_job,
    get_job,
    get_job_details,
    specify_job,
)
from web_annotation.utils import (
    PasswordForgottenForm,
    ResetPasswordForm,
    check_request_verification_path,
    deauthenticate,
    reset_password,
    verify_user,
)


logger = logging.getLogger(__name__)


def get_histogram_genomic_score(
    resource: GenomicResource, score_id: str,
) -> tuple[Histogram, dict[str, Any]]:
    """Get histogram and extra data for a genomic score."""
    if resource.get_type() not in [
        "allele_score", "position_score",
    ]:
        raise ValueError(f"{resource.resource_id} is not a genomic score!")
    score = build_score_from_resource(resource)
    score_def = score.score_definitions[score_id]
    return (
        score.get_score_histogram(score_id),
        {
            "small_values_desc": score_def.small_values_desc,
            "large_values_desc": score_def.large_values_desc,
        },
    )


def get_histogram_gene_score(
    resource: GenomicResource, score_id: str,
) -> tuple[Histogram, dict[str, Any]]:
    """Get histogram and extra data for a gene score."""
    if resource.get_type() != "gene_score":
        raise ValueError(f"{resource.resource_id} is not a genomic score!")
    score = build_gene_score_from_resource(resource)
    score_def = score.score_definitions[score_id]
    return (
        score.get_score_histogram(score_id),
        {
            "small_values_desc": score_def.small_values_desc,
            "large_values_desc": score_def.large_values_desc,
        },
    )


def get_histogram_not_supported(
    _resource: GenomicResource, _score: str,  # pylint: disable=unused-argument
) -> tuple[Histogram, dict[str, Any]]:
    """Return an empty histogram for unsupported resources."""
    return (NullHistogram(NullHistogramConfig("not supported")), {})


HISTOGRAM_GETTERS = {
    "allele_score": get_histogram_genomic_score,
    "position_score": get_histogram_genomic_score,
    "gene_score": get_histogram_gene_score,
}


def has_histogram(resource: GenomicResource, score: str) -> bool:
    """Check if a resource has a histogram for a score."""
    histogram_getter = HISTOGRAM_GETTERS.get(
        resource.get_type(), get_histogram_not_supported,
    )
    histogram, _details = histogram_getter(resource, score)
    return not isinstance(histogram, NullHistogram)


STARTUP_TIME = timezone.now()


def always_cache(
    *_args: list[Any], **_kwargs: dict[str, Any],
) -> datetime:
    """Function to enable a view to always be cached, due to static data."""
    return STARTUP_TIME


def get_pipelines(grr: GenomicResourceRepo) -> dict[str, dict[str, str]]:
    """Return pipelines used for file annotation."""
    pipelines: dict[str, dict[str, str]] = {}
    for resource in grr.get_all_resources():
        if resource.get_type() == "annotation_pipeline":
            impl = AnnotationPipelineImplementation(resource)
            pipelines[resource.get_id()] = {
                "id": resource.get_id(),
                "content": impl.raw,
            }
    return pipelines


def get_genome_pipelines(
    grr: GenomicResourceRepo,
) -> dict[str, AnnotationPipeline]:
    """Return genome pipelines used for single variant annotation."""

    if (
        getattr(settings, "GENOME_DEFINITIONS") is None
        or settings.GENOME_DEFINITIONS is None
    ):
        return {}

    pipelines: dict[str, AnnotationPipeline] = {}
    for genome, definition in settings.GENOME_DEFINITIONS.items():
        pipeline_id = definition.get("pipeline_id")
        assert pipeline_id is not None
        pipeline_resource = grr.get_resource(pipeline_id)
        pipeline = load_pipeline_from_grr(grr, pipeline_resource)
        pipeline.open()
        pipelines[genome] = pipeline
    genome_pipelines = pipelines

    return genome_pipelines


GRR = build_genomic_resource_repository(file_name=settings.GRR_DEFINITION_PATH)

GENOME_PIPELINES: dict[str, AnnotationPipeline] = get_genome_pipelines(GRR)

PIPELINES = get_pipelines(GRR)


class AnnotationBaseView(views.APIView):
    """Base view for views which access annotation resources."""
    def __init__(self) -> None:
        super().__init__()
        self._grr = GRR
        self.pipelines = PIPELINES
        self.genome_pipelines = GENOME_PIPELINES
        self.result_storage_dir = Path(settings.JOB_RESULT_STORAGE_DIR)

    @property
    def grr(self) -> GenomicResourceRepo:
        """Return annotation GRR."""
        return self.get_grr()

    def get_grr(self) -> GenomicResourceRepo:
        """Return annotation GRR."""
        return self._grr

    def get_grr_definition(self) -> Path | None:
        """Return annotation GRR definition."""
        path = settings.GRR_DEFINITION_PATH
        if path is None:
            return path
        return Path(path)

    def get_genome_pipeline(
        self, genome: str,
    ) -> AnnotationPipeline:
        """Return pipeline used for a genome in single variant annotation."""
        return self.genome_pipelines[genome]

    @staticmethod
    def _convert_size(filesize: str | int) -> int:
        """Convert a human readable filesize string to bytes."""
        if isinstance(filesize, int):
            return filesize
        filesize = filesize.upper()
        units: dict[str, int] = {
            "KB": 10**3, "MB": 10**6, "GB": 10**9, "TB": 10**12,
            "K": 10**3, "M": 10**6, "G": 10**9, "T": 10**12,
        }
        for unit, mult in units.items():
            if filesize.endswith(unit):
                return int(filesize.rstrip(f"{unit}")) * mult
        return int(filesize)

    def check_valid_upload_size(self, file: UploadedFile, user: User) -> bool:
        """Check if a file upload does not exceed the upload size limit."""
        if user.is_superuser:
            return True
        assert file.size is not None
        return file.size < self._convert_size(
            cast(str, settings.LIMITS["filesize"]),
        )

    def check_if_user_can_create(self, user: User) -> bool:
        """Check if a user is not limited by the daily quota."""
        if user.is_superuser:
            return True
        today = timezone.now().replace(
            hour=0, minute=0, second=0, microsecond=0)
        jobs_made = Job.objects.filter(
            created__gte=today, owner__exact=user.pk)
        if len(jobs_made) > cast(int, settings.LIMITS["daily_jobs"]):
            return False
        return True

    def _get_annotation_config(
        self,
        data: QueryDict,
        files: MultiValueDict,
    ) -> str:
        """Get annotation config contents from a request."""
        if "pipeline" in data:
            pipeline_id = data["pipeline"]
            if pipeline_id not in self.pipelines:
                raise ValueError(f"Pipeline {pipeline_id} not found!")
            content = self.pipelines[pipeline_id]["content"]
        else:
            config_file = files["config"]
            assert isinstance(config_file, UploadedFile)
            try:
                raw_content = config_file.read()
                content = raw_content.decode()
            except UnicodeDecodeError as e:
                raise ValueError(
                    f"Invalid pipeline configuration file: {str(e)}") from e

        if "ASCII text" not in magic.from_buffer(content):
            raise ValueError("Invalid pipeline configuration file!")

        try:
            AnnotationConfigParser.parse_str(content, grr=self.grr)
        except (AnnotationConfigurationError, KeyError) as e:
            raise ValueError(str(e)) from e

        return content

    def get_genome(self, data: QueryDict) -> str:
        """Get genome from a request."""
        genome = data.get("genome")
        assert genome is not None

        genome_definition = settings.GENOME_DEFINITIONS.get(genome)
        assert genome_definition is not None
        reference_genome = genome_definition.get("reference_genome_id")
        if reference_genome is None:
            raise ValueError("Internal genome definition is wrong")
        return reference_genome

    def generate_job_name(self) -> str:
        """Generate a unique job name."""
        return f"job-{int(time.time())}"

    def _save_annotation_config(
        self,
        request: Request,
        config_path: Path,
    ) -> Response | None:
        assert isinstance(request.data, QueryDict)
        assert isinstance(request.FILES, MultiValueDict)
        try:
            content = self._get_annotation_config(request.data, request.FILES)
        except ValueError as e:
            return Response(
                {"reason": str(e)},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        try:
            config_path.parent.mkdir(parents=True, exist_ok=True)
            config_path.write_text(content)
        except OSError:
            logger.exception("Could not write config file")
            return Response(
                {"reason": "Could not write file!"},
                status=views.status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return None

    def _save_input_file(
        self,
        request: Request,
        input_path: Path,
    ) -> None:
        assert isinstance(request.data, QueryDict)
        assert isinstance(request.FILES, MultiValueDict)
        uploaded_file = request.FILES["data"]
        assert isinstance(uploaded_file, UploadedFile)

        input_path.parent.mkdir(parents=True, exist_ok=True)
        input_path.write_bytes(uploaded_file.read())

    def _cleanup(self, job_name: str, user_email: str) -> None:
        """Cleanup the files of a failed job."""
        data_filename = f"{job_name}"
        inputs = Path(settings.JOB_INPUT_STORAGE_DIR).glob(
            f"{user_email}/{data_filename}*")
        for in_file in inputs:
            in_file.unlink(missing_ok=True)
        config_filename = f"{job_name}.yaml"
        config_path = Path(
            settings.ANNOTATION_CONFIG_STORAGE_DIR,
            f"{user_email}/{config_filename}",
        )
        config_path.unlink(missing_ok=True)
        results = Path(
            settings.JOB_RESULT_STORAGE_DIR).glob(
                f"{user_email}/{data_filename}*")
        for out_file in results:
            out_file.unlink(missing_ok=True)

    def check_variants_limit(self, file: VariantFile, user: User) -> bool:
        """Check if a variants file does not exceed the variants limit."""
        if user.is_superuser:
            return True
        return len(list(file.fetch())) < cast(
            int, settings.LIMITS["variant_count"])

    def _validate_request(self, request: Request) -> Response | None:
        """Validate the request for creating a job."""
        if not self.check_if_user_can_create(request.user):
            return Response(
                {"reason": "Daily job limit reached!"},
                status=views.status.HTTP_403_FORBIDDEN,
            )
        if not request.content_type.startswith("multipart/form-data"):
            return Response(
                {"reason": "Invalid content type!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        assert request.data is not None
        assert isinstance(request.data, QueryDict)
        assert isinstance(request.FILES, MultiValueDict)

        genome = request.data.get("genome")
        if not genome:
            return Response(
                {"reason": "Reference genome not specified!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        if genome not in settings.GENOME_DEFINITIONS:
            return Response(
                {"reason": f"Genome {genome} is not a valid option!"},
                status=views.status.HTTP_404_NOT_FOUND,
            )

        return None

    def _basic_file_extension(self, file: UploadedFile, separator: str) -> str:
        assert file.name is not None

        if separator == "\t":
            return ".tsv"
        if separator == ",":
            return ".csv"
        if file.name.find(".vcf") > 0:
            return ".vcf"
        return ".txt"

    def _file_extension(self, request: Request) -> str:
        assert isinstance(request.data, QueryDict)
        assert isinstance(request.FILES, MultiValueDict)

        uploaded_file = request.FILES["data"]
        assert isinstance(uploaded_file, UploadedFile)
        assert uploaded_file.name is not None
        separator = request.data.get("separator")
        ext = self._basic_file_extension(uploaded_file, cast(str, separator))

        if uploaded_file.name.endswith(".gz"):
            ext = f"{ext}.gz"
        if uploaded_file.name.endswith(".bgz"):
            ext = f"{ext}.bgz"

        return ext

    def _create_job(self, request: Request) -> Response | tuple[str, Job]:
        validation_response = self._validate_request(request)
        if validation_response is not None:
            return validation_response

        assert request.data is not None
        assert isinstance(request.data, QueryDict)
        assert isinstance(request.FILES, MultiValueDict)

        try:
            reference_genome = self.get_genome(request.data)
        except ValueError as e:
            return Response(
                {"reason": str(e)},
                status=views.status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        job_name = self.generate_job_name()
        config_filename = f"{job_name}.yaml"

        config_path = Path(
            settings.ANNOTATION_CONFIG_STORAGE_DIR,
            request.user.email,
            config_filename,
        )
        save_response = self._save_annotation_config(request, config_path)
        if save_response is not None:
            return save_response

        uploaded_file = request.FILES["data"]
        assert isinstance(uploaded_file, UploadedFile)
        if uploaded_file is None:
            return Response(
                {"reason": "No file uploaded!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )
        if not self.check_valid_upload_size(uploaded_file, request.user):
            return Response(
                status=views.status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

        file_ext = self._file_extension(request)

        data_filename = f"{job_name}{file_ext}"
        input_path = Path(
            settings.JOB_INPUT_STORAGE_DIR, request.user.email, data_filename)

        try:
            self._save_input_file(request, input_path)
        except OSError:
            logger.exception("Could not write input file")

            self._cleanup(job_name, request.user.email)
            return Response(
                {"reason": "File could not be identified"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        result_path = Path(
            settings.JOB_RESULT_STORAGE_DIR, request.user.email, data_filename)
        result_path.parent.mkdir(parents=True, exist_ok=True)

        job = Job(input_path=input_path,
                  config_path=config_path,
                  result_path=result_path,
                  reference_genome=reference_genome,
                  owner=request.user)
        return (job_name, job)


class JobAll(generics.ListAPIView):
    """Generic view for listing all jobs."""
    queryset = Job.objects.filter(is_active=True)
    serializer_class = JobSerializer
    permission_classes = [permissions.IsAdminUser]


class JobList(generics.ListAPIView):
    """Generic view for listing jobs for the user."""
    def get_queryset(self) -> QuerySet:
        return Job.objects.filter(owner=self.request.user, is_active=True)

    serializer_class = JobSerializer
    permission_classes = [permissions.IsAuthenticated]


class JobDetail(AnnotationBaseView):
    """View for listing job details."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request, pk: int) -> Response:
        """
        Get job details.

        Returns extra column information for TSV/CSV jobs.
        """

        try:
            job = get_job(pk)
        except ObjectDoesNotExist:
            return Response(status=views.status.HTTP_404_NOT_FOUND)

        if job.owner != request.user:
            return Response(status=views.status.HTTP_403_FORBIDDEN)

        response = {
            "id": job.pk,
            "owner": job.owner.email,
            "created": str(job.created),
            "duration": job.duration,
            "command_line": job.command_line,
            "status": job.status,
        }
        try:
            details = get_job_details(pk)
        except ObjectDoesNotExist:
            return Response(response, status=views.status.HTTP_200_OK)

        response["columns"] = details.columns.split(";")
        file_head = extract_head(
            str(job.input_path),
            details.separator,
            n_lines=5,
        )
        response["head"] = file_head

        return Response(response, status=views.status.HTTP_200_OK)

    def delete(self, request: Request, pk: int) -> Response:
        """
        Delete job details.

        Returns extra column information for TSV/CSV jobs.
        """

        try:
            job = get_job(pk)
        except ObjectDoesNotExist:
            return Response(status=views.status.HTTP_404_NOT_FOUND)

        if job.owner != request.user:
            return Response(status=views.status.HTTP_403_FORBIDDEN)

        job.deactivate()

        return Response(status=views.status.HTTP_200_OK)


class AnnotateVCF(AnnotationBaseView):
    """View for creating jobs."""

    parser_classes = [MultiPartParser]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request) -> Response:
        """Run VCF annotation job."""
        job_or_response = self._create_job(request)
        if isinstance(job_or_response, Response):
            return job_or_response
        job_name, job = job_or_response

        try:
            vcf = VariantFile(job.input_path)
        except (ValueError, OSError):
            logger.exception("Failed to parse VCF file")
            self._cleanup(job_name, job.owner.email)
            return Response(
                {"reason": "Invalid VCF file"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )
        except NotImplementedError:
            logger.exception("GZip upload")
            self._cleanup(job_name, job.owner.email)
            return Response(
                {
                    "reason": (
                        "Uploaded VCF file not supported"
                        " (GZipped not supported)."
                    )
                },
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        if not self.check_variants_limit(vcf, request.user):
            self._cleanup(job_name, job.owner.email)
            return Response(
                status=views.status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

        job.save()
        work_dir = self.result_storage_dir / request.user.email
        annotate_vcf_job.delay(
            job.pk,
            str(work_dir),
            str(self.get_grr_definition()),
        )

        return Response(status=views.status.HTTP_204_NO_CONTENT)


class AnnotateColumns(AnnotationBaseView):
    """View for creating jobs."""

    parser_classes = [MultiPartParser]
    permission_classes = [permissions.IsAuthenticated]
    tool_columns = [
        "col_chrom",
        "col_pos",
        "col_ref",
        "col_alt",
        "col_pos_beg",
        "col_pos_end",
        "col_cnv_type",
        "col_vcf_like",
        "col_variant",
        "col_location",
    ]

    def is_vcf_file(self, file: UploadedFile, input_path: Path) -> bool:
        """Check if a file is a VCF file."""
        assert file.name is not None
        if file.name.endswith(".vcf"):
            return True
        if file.name.endswith(".tsv") or file.name.endswith(".csv"):
            return False

        try:
            VariantFile(str(input_path.absolute()), "r")
        except ValueError:
            return False
        except OSError:
            return False

        return True

    def post(self, request: Request) -> Response:
        """Run column annotation job."""

        job_or_response = self._create_job(request)
        if isinstance(job_or_response, Response):
            return job_or_response
        _, job = job_or_response

        job.save()

        assert isinstance(request.data, QueryDict)
        if not any(param in self.tool_columns for param in request.data):
            logger.debug("No column options sent in request body!")
            return Response(
                {"reason": "Invalid column specification!"},
                status=views.status.HTTP_400_BAD_REQUEST)

        sep = request.data.get("separator")

        params = {"separator": sep}
        for col in self.tool_columns:
            params[col] = request.data.get(col, "")
            assert isinstance(params[col], str)

        grr_definition = self.get_grr_definition()
        assert grr_definition is not None
        try:
            job = specify_job(job, **cast(dict[str, str], params))
            work_dir = self.result_storage_dir / request.user.email
            annotate_columns_job.delay(
                job.pk, str(work_dir), str(grr_definition))
        except ObjectDoesNotExist:
            logger.exception("Job not found!")
            return Response(status=views.status.HTTP_404_NOT_FOUND)
        except Exception:  # pylint: disable=broad-exception-caught
            logger.exception("Failed to annotate columns!")
            return Response(
                {"reason": "Failed to annotate columns!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        return Response(status=views.status.HTTP_204_NO_CONTENT)


class JobGetFile(views.APIView):
    """View for downloading job files."""
    permission_classes = [permissions.IsAuthenticated]

    def get(
        self, request: Request, pk: int, file: str,
    ) -> Response | FileResponse:
        """Download a file from a job."""
        job = get_object_or_404(Job, id=pk, is_active=True)
        if not has_job_permission(job, request.user):
            return Response(status=views.status.HTTP_403_FORBIDDEN)

        if file == "input":
            file_path = Path(job.input_path)
        elif file == "config":
            file_path = Path(job.config_path)
        elif file == "result":
            file_path = Path(job.result_path)
        else:
            return Response(
                {"reason": "Not requesting input, config or result file!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        if not file_path.exists():
            return Response(status=views.status.HTTP_404_NOT_FOUND)
        return FileResponse(open(file_path, "rb"), as_attachment=True)


class UserList(generics.ListAPIView):
    """Generic view for listing users."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]


class UserDetail(generics.RetrieveAPIView):
    """Generic view for listing a user's details"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]


class UserInfo(views.APIView):
    """View that returns the request session's user information."""

    def get_user_daily_limit(self, user: User) -> int | None:
        """Return the daily job limit for a user."""
        if user.is_superuser:
            return None
        return cast(int, settings.LIMITS["daily_jobs"])

    def get_user_filesize_limit(self, user: User) -> str | None:
        """Return the file size limit for a user."""
        if user.is_superuser:
            return None
        return cast(str, settings.LIMITS["filesize"])

    def get_user_variant_limit(self, user: User) -> int | None:
        """Return the variant count limit for a user."""
        if user.is_superuser:
            return None
        return cast(int, settings.LIMITS["variant_count"])

    def get_user_jobs_left(self, user: User) -> int | None:
        """Return the number of jobs left for a user today."""
        if user.is_superuser:
            return None
        today = timezone.now().replace(
            hour=0, minute=0, second=0, microsecond=0)
        jobs_made = Job.objects.filter(
            created__gte=today, owner__exact=user.pk)
        daily_limit = cast(int, settings.LIMITS["daily_jobs"])
        return max(0, daily_limit - len(jobs_made))

    def get(self, request: Request) -> Response:
        user = request.user
        if not user.is_authenticated:
            return Response({"loggedIn": False})

        return Response(
            {
                "loggedIn": True,
                "email": user.email,
                "limitations": {
                    "daily_jobs": self.get_user_daily_limit(user),
                    "filesize": self.get_user_filesize_limit(user),
                    "variant_count": self.get_user_variant_limit(user),
                    "jobs_left": self.get_user_jobs_left(user),
                }
            },
            views.status.HTTP_200_OK,
        )


class Logout(views.APIView):
    """View for logging out."""
    def get(self, request: Request) -> Response:
        logout(cast(HttpRequest, request))
        return Response(views.status.HTTP_204_NO_CONTENT)


class Login(views.APIView):
    """View for logging in."""
    parser_classes = [JSONParser]

    def post(self, request: Request) -> Response:
        """Log in a user."""
        assert isinstance(request.data, dict)
        if "email" not in request.data:
            return Response(
                {"error": "An email is required to log in"},
                status=views.status.HTTP_400_BAD_REQUEST)
        if "password" not in request.data:
            return Response(
                {"error": "A password is required to log in"},
                status=views.status.HTTP_400_BAD_REQUEST)

        email = request.data["email"]
        password = request.data["password"]
        assert isinstance(email, str)
        assert isinstance(password, str)

        user = authenticate(
            cast(HttpRequest, request), email=email, password=password)
        if user is None:
            return Response(
                {"error": "Invalid login credentials"},
                status=views.status.HTTP_400_BAD_REQUEST)

        login(cast(HttpRequest, request), user)

        umodel = User.objects.get(email=email)
        return Response(
            {"email": umodel.email,
             "isAdmin": umodel.is_superuser},
            status=views.status.HTTP_200_OK)


class Registration(views.APIView):
    """Registration related view."""
    parser_classes = [JSONParser]

    def post(self, request: Request) -> Response:
        """Register a new user."""
        assert isinstance(request.data, dict)
        if "email" not in request.data:
            return Response(
                {"error": "An email is required to register"},
                status=views.status.HTTP_400_BAD_REQUEST)
        if "password" not in request.data:
            return Response(
                {"error": "A password is required to register"},
                status=views.status.HTTP_400_BAD_REQUEST)

        email = str(request.data["email"])
        password = str(request.data["password"])

        if User.objects.filter(email=email).exists():
            return Response(
                {"error": "This email is already in use"},
                status=views.status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            email,
            email,
            password,
            is_active=settings.USERS_ACTIVATED_BY_DEFAULT,
        )
        user.save()
        verify_user(user)
        return Response(status=views.status.HTTP_200_OK)


class ListPipelines(AnnotationBaseView):
    """View for listing all annotation pipelines for files."""

    def get(self, request: Request) -> Response:
        return Response(
            self.pipelines.values(),
            status=views.status.HTTP_200_OK,
        )


class AnnotationConfigValidation(AnnotationBaseView):
    """Validate annotation config."""

    def post(self, request: Request) -> Response:
        """Validate annotation config."""

        assert request.data is not None
        assert isinstance(request.data, dict)

        content = request.data.get("config")
        assert isinstance(content, str)

        result = {"errors": ""}

        try:
            AnnotationConfigParser.parse_str(content, grr=self.grr)
        except (AnnotationConfigurationError, KeyError) as e:
            error = str(e)
            if error == "":
                result = {"errors": "Invalid configuration"}
            else:
                result = {"errors": f"Invalid configuration, reason: {error}"}
        except Exception:  # pylint: disable=broad-exception-caught
            result = {"errors": "Invalid configuration"}

        return Response(result, status=views.status.HTTP_200_OK)


class PreviewFileUpload(AnnotationBaseView):
    """Try to determine the separator of a file split into columns"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request) -> Response:
        """Determine the separator of a file split into columns."""
        assert isinstance(request.FILES, MultiValueDict)
        assert isinstance(request.data, QueryDict)

        file = request.FILES["data"]
        assert isinstance(file, UploadedFile)
        if file is None:
            return Response(
                {"reason": "No preview file provided!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )
        if not self.check_valid_upload_size(file, request.user):
            return Response(
                status=views.status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

        assert file.name is not None

        if file.name.find(".vcf") > 0:
            return Response(
                {"reason": "VCF files cannot be previewed!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        preview_data = columns_file_preview(file, request.data.get("separator"))
        return Response(
            preview_data,
            status=views.status.HTTP_200_OK,
        )


class ListGenomePipelines(AnnotationBaseView):
    """View for listing available single annotation genomes."""

    def get(self, request: Request) -> Response:
        """Return list of genome pipelines for single annotation."""
        return Response(
            list(self.genome_pipelines.keys()),
            status=views.status.HTTP_200_OK,
        )


class SingleAnnotation(AnnotationBaseView):
    """Single annotation view."""

    throttle_classes = [UserRateThrottle]

    def generate_annotator_help(
        self,
        annotator: Annotator,
        attribute_info: AttributeInfo,
    ) -> str | None:
        """Generate annotator help for gene scores and genomic scores"""
        if not isinstance(
            annotator, (GeneScoreAnnotator, GenomicScoreAnnotatorBase),
        ):
            return None

        if isinstance(annotator, GenomicScoreAnnotatorBase):
            assert isinstance(annotator, GenomicScoreAnnotatorBase)
            return _build_score_help(
                annotator,
                attribute_info,
                annotator.score,
            )

        assert isinstance(annotator, GeneScoreAnnotator)
        for score_def in annotator.score.score_definitions.values():
            if score_def.score_id == attribute_info.source:
                return _build_gene_score_help(
                    score_def,
                    annotator.score,
                )
        return None

    def post(self, request: Request) -> Response:
        """View for single annotation"""

        assert isinstance(request.data, dict)
        if "variant" not in request.data:
            return Response(
                {"reason": "Variant not provided!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )
        if "genome" not in request.data:
            return Response(
                {"reason": "Genome not provided!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )
        variant = request.data["variant"]
        assert isinstance(variant, dict)
        genome = request.data["genome"]
        assert isinstance(genome, str)

        pipeline = self.get_genome_pipeline(genome)

        vcf_annotatable = VCFAllele(
            variant["chrom"], variant["pos"],
            variant["ref"], variant["alt"],
        )

        annotation = pipeline.annotate(vcf_annotatable, {})

        annotators_data = []
        if (
            getattr(settings, "RESOURCES_BASE_URL") is None
            or settings.RESOURCES_BASE_URL is None
        ):
            base_url = None
        else:
            base_url = settings.RESOURCES_BASE_URL

        for annotator in pipeline.annotators:
            details = {}
            attributes = []
            annotator_info = annotator.get_info()
            details = {
                "name": annotator_info.type,
                "description": annotator_info.documentation,
                "resource_id": ", ".join(
                    r.resource_id for r in annotator_info.resources),
            }
            if base_url is not None:
                details["resource_url"] = \
                    f"{base_url}{annotator_info.resources[0].resource_id}"
            else:
                details["resource_url"] = \
                    annotator_info.resources[0].resource_id
            details["resource_url"] = f'{details["resource_url"]}/index.html'
            for attribute_info in annotator.attributes:
                if attribute_info.internal:
                    continue
                attributes.append(
                    self._build_attribute_description(
                        annotation, annotator,
                        attribute_info)
                )
            if len(attributes) == 0:
                continue
            annotators_data.append(
                {"details": details, "attributes": attributes},
            )

        variant = {
            "chromosome": vcf_annotatable.chrom,
            "position": vcf_annotatable.pos,
            "reference": vcf_annotatable.ref,
            "alternative": vcf_annotatable.alt,
            "variant_type": vcf_annotatable.type.name,
        }

        response_data = {
            "variant": variant,
            "annotators": annotators_data,
        }

        return Response(response_data)

    def _build_attribute_description(
            self, result: dict[str, Any], annotator: Annotator,
            attribute_info: AttributeInfo,
    ) -> dict[str, Any]:
        resource = self.grr.get_resource(
                    list(annotator.resource_ids)[0])
        if has_histogram(resource, attribute_info.source):
            histogram_path = (
                        f"histograms/{resource.resource_id}"
                        f"?score_id={attribute_info.source}"
                    )
        else:
            histogram_path = None
        value = result[attribute_info.name]

        annotator_help = self.generate_annotator_help(
                    annotator,
                    attribute_info,
                )

        if attribute_info.type in ["object", "annotatable"]:
            if not isinstance(value, (dict, list)):
                value = str(value)
        return {
                    "name": attribute_info.name,
                    "description": attribute_info.description,
                    "help": annotator_help,
                    "source": attribute_info.source,
                    "type": attribute_info.type,
                    "result": {
                        "value": value,
                        "histogram": histogram_path,
                    },
        }


class HistogramView(AnnotationBaseView):
    """View for returning histogram data."""

    @method_decorator(last_modified(always_cache))
    def get(self, request: Request, resource_id: str) -> Response:
        """Return histogram data for a resource and score ID."""
        try:
            resource = self.grr.get_resource(resource_id)
        except ValueError:
            return Response(status=views.status.HTTP_404_NOT_FOUND)

        score_id = request.query_params.get("score_id")
        if score_id is None:
            return Response(
                {"reason": "Score id not provided!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        histogram_getter = HISTOGRAM_GETTERS.get(
            resource.get_type(), get_histogram_not_supported,
        )

        histogram, extra_data = histogram_getter(
            resource, score_id,
        )
        if isinstance(histogram, NullHistogram):
            return Response(status=views.status.HTTP_404_NOT_FOUND)

        output = {
            **histogram.to_dict(),
            **extra_data,
        }

        return Response(output)


class ConfirmAccount(views.APIView):  # USE
    """View for forgotten password."""
    verification_code_model = cast(
        BaseVerificationCode, AccountConfirmationCode,
    )
    code_type = "confirmation"

    def get(self, request: Request) -> HttpResponse:
        """Render the password reset form."""

        verif_code, msg = \
            check_request_verification_path(
                request.GET.get("code"),
                request,
                self.code_type,
                self.verification_code_model,
            )

        if msg is not None:
            if verif_code is not None:
                verif_code.delete()

        activated = False
        if verif_code is not None:
            user: User = verif_code.user
            verif_code.delete()
            user.activate()
            activated = True

        redirect_uri = (
            f"{settings.EMAIL_REDIRECT_ENDPOINT}"
            f"/login?activation_successful={activated}"
        )
        return HttpResponseRedirect(redirect_uri)


class ForgotPassword(views.APIView):
    """View for forgotten password."""

    def get(self, request: Request) -> HttpResponse:
        form = PasswordForgottenForm()

        return render(
            cast(HttpRequest, request),
            "forgotten-password.html",
            {"form": form, "show_form": True},
        )

    def post(self, request: Request) -> HttpResponse:
        """Send a reset password email to the user."""
        data = request.data
        form = PasswordForgottenForm(data)  # pyright: ignore
        is_valid = form.is_valid()
        if not is_valid:
            return render(
                cast(HttpRequest, request),
                "forgotten-password.html",
                {
                    "form": form,
                    "message": "Invalid email",
                    "message_type": "warn",
                    "show_form": True,
                },
                status=views.status.HTTP_400_BAD_REQUEST,
            )
        email = form.data["email"]
        user_model = get_user_model()
        message = (
            f"An e-mail has been sent to {email}"
            " containing the reset link"
        )
        try:
            user = user_model.objects.filter(email=email).first()
            if user is None or not isinstance(user, User):
                return render(
                    request,  # pyright: ignore
                    "forgotten-password.html",
                    {
                        "form": form,
                        "message": "User is not a GPFWA User",
                        "message_type": "warn",
                        "show_form": True,
                    },
                    status=views.status.HTTP_400_BAD_REQUEST,
                )

            reset_password(user)

            return render(
                request,  # pyright: ignore
                "forgotten-password.html",
                {
                    "form": form,
                    "message": message,
                    "message_type": "success",
                    "show_form": False,
                },
            )
        except user_model.DoesNotExist:
            return render(
                request,  # pyright: ignore
                "forgotten-password.html",
                {
                    "form": form,
                    "message": message,
                    "message_type": "success",
                    "show_form": False,
                },
            )


class PasswordReset(views.APIView):
    """Reset password view."""

    verification_code_model = cast(BaseVerificationCode, ResetPasswordCode)

    template = "reset-password.html"
    form = cast(forms.Form, ResetPasswordForm)
    code_type = "reset"

    def get(self, request: Request) -> HttpResponse:
        """Render the password reset form."""

        verif_code, msg = \
            check_request_verification_path(
                request.GET.get("code"),
                request,
                self.code_type,
                self.verification_code_model,
            )

        if msg is not None:
            if verif_code is not None:
                verif_code.delete()
            assert self.template is not None
            return render(
                request,  # pyright: ignore
                self.template,
                {"message": msg},
                status=views.status.HTTP_400_BAD_REQUEST,
            )
        assert verif_code is not None
        user = verif_code.user

        assert self.form is not None
        # pylint: disable=not-callable
        form = self.form(user)  # type: ignore
        request.session[f"{self.code_type}_code"] = verif_code.path
        request.path = request.path[:request.path.find("?")]  # pyright: ignore
        assert self.template is not None
        return render(
            request,  # pyright: ignore
            self.template,
            {"form": form},
        )

    def post(self, request: Request) -> HttpResponse:
        """Handle the password reset form."""
        assert isinstance(request.POST, QueryDict)
        verif_code, msg = \
            check_request_verification_path(
                request.POST.get("code"),
                request,
                self.code_type,
                self.verification_code_model,
            )
        assert self.template is not None
        if msg is not None:
            if verif_code is not None:
                verif_code.delete()
            return render(
                request,  # pyright: ignore
                self.template,
                {"message": msg},
                status=views.status.HTTP_400_BAD_REQUEST,
            )
        assert verif_code is not None
        user: User = verif_code.user
        # pylint: disable=not-callable
        form = self.form(user, data=request.data)  # type: ignore
        is_valid = form.is_valid()
        if not is_valid:
            return render(
                request,  # pyright: ignore
                self.template,
                {
                    "form": form,
                },
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        new_password = form.cleaned_data["new_password1"]
        if not user.is_active:
            user.activate()
        else:
            deauthenticate(user)
        user.change_password(new_password)

        if verif_code is not None:
            verif_code.delete()

        redirect_uri = settings.EMAIL_REDIRECT_ENDPOINT
        return HttpResponseRedirect(redirect_uri)
