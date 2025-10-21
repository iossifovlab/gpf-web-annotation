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
)
from dae.annotation.annotation_factory import load_pipeline_from_grr
from dae.annotation.annotation_pipeline import AnnotationPipeline
from dae.gene_scores.gene_scores import build_gene_score_from_resource
from dae.genomic_resources.genomic_scores import build_score_from_resource
from dae.genomic_resources.implementations.annotation_pipeline_impl import (
    AnnotationPipelineImplementation,
)
from dae.genomic_resources.repository import \
    GenomicResource, GenomicResourceRepo
from dae.genomic_resources.repository_factory import \
    build_genomic_resource_repository
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

from web_annotation.utils import (
    PasswordForgottenForm,
    ResetPasswordForm,
    check_request_verification_path,
    deauthenticate,
    reset_password,
    verify_user,
)

from .models import (
    AccountConfirmationCode,
    BaseVerificationCode,
    Job,
    JobDetails,
    ResetPasswordCode,
    User,
)
from .permissions import IsOwner, has_job_permission
from .serializers import JobSerializer, UserSerializer
from .tasks import annotate_vcf_job, annotate_columns_job, get_job, get_job_details, specify_job

logger = logging.getLogger(__name__)


def get_histogram_genomic_score(
    resource: GenomicResource, score: str,
) -> dict[str, Any]:
    """Get histogram for a genomic score."""
    if resource.get_type() not in [
        "allele_score", "position_score",
    ]:
        raise ValueError(f"{resource.resource_id} is not a genomic score!")
    return build_score_from_resource(
        resource).get_score_histogram(score).to_dict()


def get_histogram_gene_score(
    resource: GenomicResource, score: str,
) -> dict[str, Any]:
    """Get histogram from a gene score resource."""
    if resource.get_type() != "gene_score":
        raise ValueError(f"{resource.resource_id} is not a genomic score!")
    return build_gene_score_from_resource(
        resource).get_score_histogram(score).to_dict()


def get_histogram_not_supported(
    resource: GenomicResource, score: str,  # pylint: disable=unused-argument
) -> dict[str, Any]:
    """Return an empty histogram for unsupported resources."""
    return {}


HISTOGRAM_GETTERS = {
    "allele_score": get_histogram_genomic_score,
    "position_score": get_histogram_genomic_score,
    "gene_score": get_histogram_gene_score,
}

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
        getattr(settings, "GENOME_PIPELINES") is None
        or settings.GENOME_PIPELINES is None
    ):
        GENOME_PIPELINES = {}
        return {}
    else:
        pipelines: dict[str, AnnotationPipeline] = {}
        for genome, pipeline_id in settings.GENOME_PIPELINES.items():
            pipeline_resource = grr.get_resource(pipeline_id)
            pipeline = load_pipeline_from_grr(grr, pipeline_resource)
            pipeline.open()
            pipelines[genome] = pipeline
        GENOME_PIPELINES = pipelines
    return GENOME_PIPELINES


GRR = build_genomic_resource_repository(file_name=settings.GRR_DEFINITION)

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
        path = settings.GRR_DEFINITION
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
        try:
            job = get_job(pk)
        except ObjectDoesNotExist:
            return Response(status=views.status.HTTP_404_NOT_FOUND)

        if job.owner != request.user:
            return Response(status=views.status.HTTP_403_FORBIDDEN)

        response = {
            "job_id": job.pk,
            "owner": job.owner.email,
            "created": str(job.created),
            "status": job.status,
        }
        try:
            details = get_job_details(pk)
        except ObjectDoesNotExist:
            return Response(response, status=views.status.HTTP_200_OK)

        content = Path(job.input_path).read_text()
        lines = content.split("\n")
        header = lines[0]
        sep = details.separator

        file_header = [dict(
            zip(header.split(sep), line.split(sep), strict=True)
        ) for line in lines[1:5]]
        response["columns"] = details.columns.split(";")
        response["head"] = file_header

        return Response(response, status=views.status.HTTP_200_OK)


class JobCreate(AnnotationBaseView):
    parser_classes = [MultiPartParser]
    permission_classes = [permissions.IsAuthenticated]

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
        if len(jobs_made) > settings.LIMITS["daily_jobs"]:
            return False
        return True

    def check_variants_limit(self, file: VariantFile, user: User) -> bool:
        """Check if a variants file does not exceed the variants limit."""
        if user.is_superuser:
            return True
        return len(list(file.fetch())) < cast(
            int, settings.LIMITS["variant_count"])

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
        else:
            return True

    def is_columns_file(self, file: UploadedFile, input_path: Path) -> bool:
        """Check if a file is a TSV or CSV file."""
        assert file.name is not None
        if file.name.endswith(".vcf"):
            return False
        if file.name.endswith(".tsv") or file.name.endswith(".csv"):
            return True
        try:
            cols_file_content = input_path.read_text()
        except UnicodeDecodeError:
            return False
        lines = cols_file_content.split("\n")
        if len(lines) >= 2:
            header = lines[0].strip()
            if len(header.split(",")) >= 4:
                return True
            if len(header.split("\t")) >= 4:
                return True
            return False
        return False

    def _get_config_raw_from_request(self, request: Request) -> str:
        """Get annotation config contents from a request."""
        assert isinstance(request.data, QueryDict)
        assert isinstance(request.FILES, MultiValueDict)
        if "pipeline" in request.data:
            pipeline_id = request.data["pipeline"]
            if pipeline_id not in self.pipelines:
                raise ValueError(f"Pipeline {pipeline_id} not found!")
            content = self.pipelines[pipeline_id]["content"]
        else:
            config_file = request.FILES["config"]
            assert isinstance(config_file, UploadedFile)
            raw_content = config_file.read()
            content = raw_content.decode()
        return content

    def _cleanup(self, job_name: str) -> None:
        """Cleanup the files of a failed job."""
        data_filename = f"{job_name}"
        inputs = Path(settings.JOB_INPUT_STORAGE_DIR).glob(f"{data_filename}*")
        for in_file in inputs:
            in_file.unlink(missing_ok=True)
        config_filename = f"{job_name}.yaml"
        config_path = Path(
            settings.ANNOTATION_CONFIG_STORAGE_DIR, config_filename)
        config_path.unlink(missing_ok=True)
        results = Path(
            settings.JOB_RESULT_STORAGE_DIR).glob(f"{data_filename}*")
        for out_file in results:
            out_file.unlink(missing_ok=True)

    def post(self, request: Request) -> Response:
        if not self.check_if_user_can_create(request.user):
            return Response(
                {"reason": "Daily job limit reached!"},
                status=views.status.HTTP_403_FORBIDDEN,
            )

        job_name = f"job-{int(time.time())}"

        assert request.data is not None
        assert isinstance(request.data, QueryDict)
        assert isinstance(request.FILES, MultiValueDict)

        config_filename = f"{job_name}.yaml"
        try:
            content = self._get_config_raw_from_request(request)
        except UnicodeDecodeError:
            return Response(
                {"reason": "Invalid pipeline configuration file"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )
        except ValueError as e:
            return Response(
                {"reason": str(e)},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        if "ASCII text" not in magic.from_buffer(content):
            return Response(status=views.status.HTTP_400_BAD_REQUEST)

        try:
            AnnotationConfigParser.parse_str(content, grr=self.grr)
        except (AnnotationConfigurationError, KeyError) as e:
            return Response(
                {"reason": str(e)},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        config_path = Path(
            settings.ANNOTATION_CONFIG_STORAGE_DIR,
            request.user.email,
            config_filename,
        )
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(content)

        uploaded_file = request.FILES["data"]
        assert isinstance(uploaded_file, UploadedFile)
        if uploaded_file is None:
            return Response(status=views.status.HTTP_400_BAD_REQUEST)
        if not self.check_valid_upload_size(uploaded_file, request.user):
            return Response(
                status=views.status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

        data_filename = f"{job_name}"
        input_path = Path(
            settings.JOB_INPUT_STORAGE_DIR, request.user.email, data_filename)
        input_path.parent.mkdir(parents=True, exist_ok=True)
        input_path.write_bytes(uploaded_file.read())
        if self.is_vcf_file(uploaded_file, input_path):
            data_filename = f"{job_name}.vcf"
            input_path = input_path.rename(
                Path(settings.JOB_INPUT_STORAGE_DIR,
                     request.user.email, data_filename))
        elif self.is_columns_file(uploaded_file, input_path):
            data_filename = f"{job_name}.txt"
            input_path = input_path.rename(
                Path(settings.JOB_INPUT_STORAGE_DIR,
                     request.user.email, data_filename))
        else:
            self._cleanup(job_name)
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
                  owner=request.user)

        if data_filename.endswith(".vcf"):
            try:
                vcf = VariantFile(str(input_path.absolute()), "r")
            except ValueError:
                self._cleanup(job_name)
                return Response(
                    {"reason": "Invalid VCF file"},
                    status=views.status.HTTP_400_BAD_REQUEST,
                )

            if not self.check_variants_limit(vcf, request.user):
                self._cleanup(job_name)
                return Response(
                    status=views.status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

            job.save()
            annotate_vcf_job.delay(
                job.pk,
                str(self.result_storage_dir),
                str(self.get_grr_definition()),
            )

            return Response(status=views.status.HTTP_204_NO_CONTENT)
        else:
            cols_file_content = input_path.read_text()
            lines = cols_file_content.split("\n")
            header = lines[0]
            if len(header.split(",")) >= 4:
                sep = ","
            elif len(header.split("\t")) >= 4:
                sep = "\t"
            else:
                self._cleanup(job_name)
                return Response(
                    {"reason": "Invalid input file"},
                    status=views.status.HTTP_400_BAD_REQUEST,
                )
            columns = ";".join(header.split(sep))
            job.status = job.Status.SPECIFYING
            job_details = JobDetails(columns=columns, separator=sep, job=job)
            file_header = [dict(
                zip(header.split(sep), line.split(sep), strict=True)
            ) for line in lines[1:5]]

            assert file_header is not None
            job.save()
            job_details.save()
            return Response(
                {
                    "job_id": job.pk,
                    "columns": job_details.columns.split(";"),
                    "head": file_header,
                },
                status=views.status.HTTP_200_OK,
            )


class JobSpecify(AnnotationBaseView):
    """View for specifying a csv or tsv job's columns."""
    def post(self, request: Request, pk: int) -> Response:
        assert isinstance(request.data, QueryDict)
        if not all(
            col in request.data for col in
            ["col_chrom", "col_pos", "col_ref", "col_alt"]
        ):
            return Response(status=views.status.HTTP_400_BAD_REQUEST)

        col_chrom = request.data["col_chrom"]
        assert isinstance(col_chrom, str)
        col_pos = request.data["col_pos"]
        assert isinstance(col_pos, str)
        col_ref = request.data["col_ref"]
        assert isinstance(col_ref, str)
        col_alt = request.data["col_alt"]
        assert isinstance(col_alt, str)
        grr_definition = self.get_grr_definition()
        assert grr_definition is not None
        try:
            job = specify_job(
                pk,
                col_chrom=col_chrom,
                col_pos=col_pos,
                col_ref=col_ref,
                col_alt=col_alt,
            )
            annotate_columns_job.delay(
                job.pk, str(self.result_storage_dir), str(grr_definition))

        except ObjectDoesNotExist:
            return Response(status=views.status.HTTP_404_NOT_FOUND)
        return Response(status=views.status.HTTP_204_NO_CONTENT)


class JobGetFile(views.APIView):
    """View for downloading job files."""
    permission_classes = [permissions.IsAuthenticated]

    def get(
        self, request: Request, pk: int, file: str,
    ) -> Response | FileResponse:
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
            return Response(status=views.status.HTTP_400_BAD_REQUEST)

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
    def get(self, request: Request) -> Response:
        user = request.user
        if not user.is_authenticated:
            return Response({"loggedIn": False})
        return Response(
            {
                "loggedIn": True,
                "email": user.email,
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

        user = authenticate(request, email=email, password=password)
        if user is None:
            return Response(
                {"error": "Invalid login credentials"},
                status=views.status.HTTP_400_BAD_REQUEST)

        login(request, user)

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


class ListGenomePipelines(AnnotationBaseView):
    """View for listing available single annotaiton genomes."""

    def get(self, request: Request) -> Response:
        return Response(
            list(self.genome_pipelines.keys()),
            status=views.status.HTTP_200_OK,
        )


class SingleAnnotation(AnnotationBaseView):
    """Single annotation view."""

    throttle_classes = [UserRateThrottle]

    def post(self, request: Request) -> Response:

        if "variant" not in request.data:
            return Response(status=views.status.HTTP_400_BAD_REQUEST)
        if "genome" not in request.data:
            return Response(status=views.status.HTTP_400_BAD_REQUEST)
        variant = request.data["variant"]
        genome = request.data["genome"]

        pipeline = self.get_genome_pipeline(genome)

        vcf_annotatable = VCFAllele(
            variant["chrom"], variant["pos"],
            variant["ref"], variant["alt"],
        )

        result = pipeline.annotate(vcf_annotatable, {})

        annotators_data = []

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
            for attribute_info in annotator.attributes:
                if attribute_info.internal:
                    continue
                resource = self.grr.get_resource(
                    list(annotator.resource_ids)[0])
                if resource.get_type() in HISTOGRAM_GETTERS.keys():
                    histogram_path = (
                        f"histograms/{resource.resource_id}"
                        f"?score_id={attribute_info.source}"
                    )
                else:
                    histogram_path = None
                value = result[attribute_info.name]
                if attribute_info.type in ["object", "annotatable"]:
                    value = str(value)
                attributes.append({
                    "name": attribute_info.name,
                    "description": attribute_info.description,
                    "source": attribute_info.source,
                    "result": {
                        "value": value,
                        "histogram": histogram_path,
                    },
                })
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


class ConfirmAccount(views.APIView):  # USE
    """View for forgotten password."""
    verification_code_model = cast(BaseVerificationCode, AccountConfirmationCode)
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


class HistogramView(AnnotationBaseView):
    """View for returning histogram data."""

    @method_decorator(last_modified(always_cache))
    def get(self, request: Request, resource_id: str) -> Response:
        try:
            resource = self.grr.get_resource(resource_id)
        except ValueError:
            return Response(status=views.status.HTTP_404_NOT_FOUND)

        score_id = request.query_params.get("score_id")
        if score_id is None:
            return Response(status=views.status.HTTP_400_BAD_REQUEST)

        histogram_getter = HISTOGRAM_GETTERS.get(
            resource.get_type(), get_histogram_not_supported,
        )

        histogram_data = histogram_getter(
            resource, score_id,
        )

        if histogram_data == {}:
            return Response(status=views.status.HTTP_404_NOT_FOUND)

        return Response(histogram_data)
