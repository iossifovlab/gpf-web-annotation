# pylint: disable=too-many-lines
"""View classes for web annotation."""
import logging
from subprocess import CalledProcessError
import time
from datetime import datetime
from pathlib import Path
from typing import Any, cast
import yaml

import magic
from dae.annotation.annotatable import VCFAllele
from dae.annotation.annotation_config import (
    AnnotationConfigParser,
    AnnotationConfigurationError,
    AttributeInfo,
)
from dae.annotation.annotation_factory import (
    build_annotation_pipeline,
    load_pipeline_from_grr,
    load_pipeline_from_yaml,
)
from dae.annotation.annotation_pipeline import AnnotationPipeline, Annotator
from dae.annotation.gene_score_annotator import GeneScoreAnnotator
from dae.annotation.record_to_annotatable import build_record_to_annotatable
from dae.annotation.score_annotator import GenomicScoreAnnotatorBase
from dae.gene_scores.gene_scores import (
    _build_gene_score_help,
    build_gene_score_from_resource,
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
from dae.genomic_resources.repository import (
    GenomicResource, GenomicResourceRepo,
)
from dae.genomic_resources.repository_factory import (
    build_genomic_resource_repository,
)
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
from rest_framework.request import MultiValueDict, QueryDict, Request
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from web_annotation.annotate_helpers import columns_file_preview, extract_head
from web_annotation.executor import (
    TaskExecutor,
    ThreadedTaskExecutor,
)
from web_annotation.pipeline_cache import LRUPipelineCache
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
    Pipeline,
    ResetPasswordCode,
    User,
)
from .permissions import has_job_permission
from .serializers import JobSerializer, UserSerializer
from .tasks import (
    get_job,
    get_job_details,
    get_args_columns,
    run_columns_job,
    get_args_vcf,
    run_vcf_job,
    specify_job,
    update_job_failed,
    update_job_in_progress,
    update_job_success,
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

    lru_cache = LRUPipelineCache(32)

    TASK_EXECUTOR: TaskExecutor = ThreadedTaskExecutor(
            max_workers=settings.ANNOTATION_MAX_WORKERS)

    """Base view for views which access annotation resources."""
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

    def _get_user_pipeline_yaml(
        self,
        pipeline_id: str,
        user: User,
    ) -> str:
        if pipeline_id in self.pipelines:
            return self.pipelines[pipeline_id]["content"]
        user_pipeline = Pipeline.objects.filter(
            owner=user,
            name=pipeline_id,
        ).first()
        if user_pipeline is not None:
            return Path(user_pipeline.config_path).read_text(encoding="utf-8")
        raise ValueError(f"Pipeline {pipeline_id} not found!")

    def _get_pipeline_yaml(
        self,
        pipeline_id: str,
        user: User,
    ) -> str:
        """Get annotation config contents from a request."""
        if pipeline_id in self.pipelines:
            content = self.pipelines[pipeline_id]["content"]
        else:
            if not isinstance(pipeline_id, str):
                raise ValueError("Pipeline id is not a string!")
            content = self._get_user_pipeline_yaml(
                pipeline_id, user)

        if "ASCII text" not in magic.from_buffer(content):
            raise ValueError("Invalid pipeline configuration file!")

        try:
            AnnotationConfigParser.parse_str(content, grr=self.grr)
        except (AnnotationConfigurationError, KeyError) as e:
            raise ValueError(str(e)) from e

        return content

    def get_pipeline(self, pipeline_id: str, user: User) -> AnnotationPipeline:
        """Get an annotation pipeline by id."""
        pipeline = self.lru_cache.get_pipeline(pipeline_id)

        if pipeline is None:
            pipeline_config = self._get_pipeline_yaml(pipeline_id, user)

            pipeline = self.lru_cache.put_pipeline(
                pipeline_id, load_pipeline_from_yaml(pipeline_config, self.grr)
            )

        return pipeline

    def get_genome(self, data: QueryDict) -> str:
        """Get genome from a request."""
        genome = data.get("genome")
        if genome is None:
            return ""
        genome_definition = settings.GENOME_DEFINITIONS.get(genome)
        assert genome_definition is not None
        reference_genome = genome_definition.get("reference_genome_id")
        if reference_genome is None:
            raise ValueError("Internal genome definition is wrong")
        return reference_genome

    def generate_job_name(self, user: User) -> int:
        job_count = Job.objects.filter(owner=user).count()
        return job_count + 1

    def _save_annotation_config(
        self,
        request: Request,
        config_path: Path,
    ) -> Response | AnnotationPipeline:
        assert isinstance(request.data, QueryDict)
        assert isinstance(request.FILES, MultiValueDict)
        if "pipeline" not in request.data:
            raise ValueError("Pipeline id not provided!")
        try:
            pipeline_id = request.data["pipeline"]
            if not isinstance(pipeline_id, str):
                raise ValueError("Pipeline id is not a string!")
            pipeline = self.get_pipeline(pipeline_id, request.user)
            if pipeline is None:
                raise KeyError(f"Pipeline {pipeline_id} not found!")
        except ValueError as e:
            return Response(
                {"reason": str(e)},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        try:
            config_path.parent.mkdir(parents=True, exist_ok=True)
            config_path.write_text(yaml.safe_dump(pipeline.raw))
        except OSError:
            logger.exception("Could not write config file")
            return Response(
                {"reason": "Could not write file!"},
                status=views.status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return pipeline

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

    def _cleanup(self, job_name: int, user_email: str) -> None:
        """Cleanup the files of a failed job."""
        data_filename = f"data-{job_name}"
        inputs = Path(settings.JOB_INPUT_STORAGE_DIR).glob(
            f"{user_email}/{data_filename}*")
        for in_file in inputs:
            in_file.unlink(missing_ok=True)
        config_filename = f"config-{job_name}.yaml"
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

        if genome and genome not in settings.GENOME_DEFINITIONS:
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

    def _create_job(
        self,
        request: Request,
        annotation_type: str,
    ) -> Response | tuple[int, AnnotationPipeline, Job]:
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

        job_name = self.generate_job_name(request.user)
        config_filename = f"config-{job_name}.yaml"

        config_path = Path(
            settings.ANNOTATION_CONFIG_STORAGE_DIR,
            request.user.email,
            config_filename,
        )
        save_response_or_pipeline = self._save_annotation_config(
            request, config_path)
        if isinstance(save_response_or_pipeline, Response):
            return save_response_or_pipeline
        pipeline = save_response_or_pipeline

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

        data_filename = f"data-{job_name}{file_ext}"
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

        result_filename = f"result-{job_name}{file_ext}"
        result_path = Path(
            settings.JOB_RESULT_STORAGE_DIR,
            request.user.email,
            result_filename,
        )
        result_path.parent.mkdir(parents=True, exist_ok=True)

        job = Job(
            name=job_name,
            input_path=input_path,
            config_path=config_path,
            result_path=result_path,
            reference_genome=reference_genome,
            owner=request.user,
            annotation_type=annotation_type
        )
        return (job_name, pipeline, job)


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
            "name": job.name,
            "owner": job.owner.email,
            "created": str(job.created),
            "duration": job.duration,
            "command_line": job.command_line,
            "status": job.status,
            "result_filename": Path(job.result_path).name,
        }
        try:
            details = get_job_details(pk)
        except ObjectDoesNotExist:
            return Response(response, status=views.status.HTTP_200_OK)

        if job.annotation_type == "columns":
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


class UserPipeline(AnnotationBaseView):
    """View for saving user annotation pipelines."""
    permission_classes = [permissions.IsAuthenticated]

    def _save_user_pipeline(
        self,
        request: Request,
        config_path: Path,
    ) -> Response | None:
        assert isinstance(request.FILES, MultiValueDict)

        config_file = request.FILES["config"]
        assert isinstance(config_file, UploadedFile)
        try:
            raw_content = config_file.read()
            content = raw_content.decode()
        except UnicodeDecodeError as e:
            raise ValueError(
                f"Invalid pipeline configuration file: {str(e)}") from e

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

    def post(self, request: Request) -> Response:
        """Create or update user annotation pipeline"""
        assert isinstance(request.data, QueryDict)
        assert isinstance(request.FILES, MultiValueDict)

        anonymous = False

        pipeline_name = request.data.get("name")
        if not pipeline_name:
            pipeline_name = f'pipeline-{int(time.time())}.yaml'
            anonymous = True

        if not anonymous and pipeline_name in self.pipelines:
            return Response(
                {"reason": (
                    "Pipeline with such name cannot be created or updated!"
                )},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        config_filename = f'{pipeline_name}.yaml'

        user_pipelines = Pipeline.objects.filter(
            owner=request.user,
            name=pipeline_name,
        )
        user_pipelines_count = user_pipelines.count()
        if user_pipelines_count > 1:
            return Response(
                {"reason": "More than one pipeline shares the same name!"},
                status=views.status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if user_pipelines_count == 0:
            config_path = Path(
                settings.ANNOTATION_CONFIG_STORAGE_DIR,
                request.user.email,
                config_filename,
            )
            pipeline = Pipeline(
                name=pipeline_name,
                config_path=config_path,
                owner=request.user,
                is_anonymous=anonymous,
            )
        else:
            pipeline = user_pipelines[0]
            config_path = Path(str(pipeline.config_path))

        pipeline_or_response = self._save_user_pipeline(
            request, config_path,
        )
        if isinstance(pipeline_or_response, Response):
            return pipeline_or_response

        pipeline.save()

        return Response(
            {"name": pipeline_name},
            status=views.status.HTTP_200_OK,
        )

    def get(self, request: Request) -> Response:
        """Get user annotation pipeline"""
        name = request.query_params.get("name")
        if not name:
            return Response(
                {"reason": "Pipeline name not provided!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        pipeline = Pipeline.objects.get(
            owner=request.user,
            name=name,
        )

        if not pipeline:
            return Response(
                {"reason": "Pipeline name not recognized!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        response = {
            "name": pipeline.name,
            "owner": pipeline.owner.email,
            "pipeline": Path(pipeline.config_path).read_text(),
        }

        return Response(response, status=views.status.HTTP_200_OK)

    def delete(self, request: Request) -> Response:
        """Delete user annotation pipeline"""
        name = request.query_params.get("name")
        if not name:
            return Response(
                {"reason": "Pipeline name not provided!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        pipeline = Pipeline.objects.filter(
            owner=request.user,
            name=name,
        )

        if pipeline.count() == 0:
            return Response(
                {"reason": "Pipeline name not recognized!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )
        if pipeline.count() > 1:
            return Response(
                {"reason": "More than one pipeline shares this name!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        pipeline.delete()

        return Response(status=views.status.HTTP_204_NO_CONTENT)


class AnnotateVCF(AnnotationBaseView):
    """View for creating jobs."""

    parser_classes = [MultiPartParser]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request) -> Response:
        """Run VCF annotation job."""
        job_or_response = self._create_job(request, "vcf")
        if isinstance(job_or_response, Response):
            return job_or_response
        job_name, pipeline, job = job_or_response

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
        pipeline = build_annotation_pipeline(pipeline.raw, pipeline.repository)
        args = get_args_vcf(
            job, pipeline, str(work_dir))
        start_time = time.time()

        def on_success(
                result: None) -> None:  # pylint: disable=unused-argument
            """Callback when annotation is done."""
            job.duration = time.time() - start_time
            update_job_success(job)

        def on_failure(exception: BaseException) -> None:
            """Callback when annotation fails."""
            logger.error(
                "VCF annotation job failed with exception: %s", str(exception)
            )
            job.duration = time.time() - start_time
            reason = (
                f"Unexpected error, {type(exception)}\n"
                f"{str(exception)}"
            )
            if isinstance(exception, CalledProcessError):
                reason = (
                    "annotate_vcf failed internally:\n"
                    f"{exception.stderr}"
                )
            if isinstance(
                exception, (OSError, TypeError, ValueError),
            ):
                reason = (
                    "Failed to execute annotate_vcf\n"
                    f"{str(exception)}"
                )
            logger.error("VCF annotation job failed!\n%s", reason)
            update_job_failed(job)

        update_job_in_progress(job)

        self.TASK_EXECUTOR.execute(
            run_vcf_job,
            callback_success=on_success,
            callback_failure=on_failure,
            **args,
        )

        return Response({"job_id": job.pk}, status=views.status.HTTP_200_OK)


class AnnotateColumns(AnnotationBaseView):
    """View for creating jobs."""

    parser_classes = [MultiPartParser]
    permission_classes = [permissions.IsAuthenticated]

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

        job_or_response = self._create_job(request, "columns")
        if isinstance(job_or_response, Response):
            return job_or_response
        _, pipeline, job = job_or_response

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
        work_dir = self.result_storage_dir / request.user.email

        try:
            specify_job(job, **cast(dict[str, str], params))
            details = get_job_details(job.pk)
        except ObjectDoesNotExist:
            logger.exception("Job not found!")
            return Response(status=views.status.HTTP_404_NOT_FOUND)

        pipeline = build_annotation_pipeline(pipeline.raw, pipeline.repository)
        args = get_args_columns(
            job, details, pipeline, str(work_dir))
        start_time = time.time()

        def on_success(result: None) -> None:
            job.duration = time.time() - start_time
            update_job_success(job)

        def on_failure(exception: BaseException) -> None:
            job.duration = time.time() - start_time
            reason = (
                f"Unexpected error, {type(exception)}\n"
                f"{(exception)}"
            )
            if isinstance(exception, CalledProcessError):
                reason = (
                    "annotate_columns failed internally:\n"
                    f"{exception.stderr}"
                )
            if isinstance(
                exception, (OSError, TypeError, ValueError),
            ):
                reason = (
                    "Failed to execute annotate_vcf\n"
                    f"{str(exception)}"
                )
            logger.error("columns annotation job failed!\n%s", reason)
            update_job_failed(job)

        update_job_in_progress(job)

        self.TASK_EXECUTOR.execute(
            run_columns_job,
            callback_success=on_success,
            callback_failure=on_failure,
            **args,
        )

        return Response({"job_id": job.pk}, status=views.status.HTTP_200_OK)


class ColumnValidation(AnnotationBaseView):
    """Validate if column selection returns annotatable."""
    def post(self, request: Request) -> Response:
        """Validate columns selection."""
        data = request.data
        assert isinstance(data, dict)

        column_mapping = data.get("column_mapping")
        if not column_mapping or column_mapping == {}:
            return Response(
                {"errors": "No columns selected from the file!"},
                status=views.status.HTTP_200_OK)
        assert isinstance(column_mapping, dict)

        if not any(param in self.tool_columns for param in column_mapping):
            return Response(
                {"errors": "Invalid column specification!"},
                status=views.status.HTTP_200_OK)

        all_columns = data.get("file_columns")
        if not all_columns or all_columns == []:
            return Response({
                    "errors": (
                        "File header must be provided "
                        "for column validation!"
                    )
                },
                status=views.status.HTTP_200_OK)
        assert isinstance(all_columns, list)
        all_columns = [str(col) for col in all_columns]

        try:
            build_record_to_annotatable(
                column_mapping,
                set(all_columns),
            )
        except ValueError:
            logger.exception("Annotatable error.\n")
            return Response(
                {
                    "errors": (
                        "Specified set of columns"
                        " cannot be used together!"
                    ),
                },
                status=views.status.HTTP_200_OK)

        return Response({"errors": ""}, status=views.status.HTTP_200_OK)


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
            return Response({"loggedIn": False}, views.status.HTTP_200_OK)

        return Response(
            {
                "loggedIn": True,
                "email": user.email,
                "limitations": {
                    "dailyJobs": self.get_user_daily_limit(user),
                    "filesize": self.get_user_filesize_limit(user),
                    "variantCount": self.get_user_variant_limit(user),
                    "jobsLeft": self.get_user_jobs_left(user),
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

    def _get_default_pipelines(self) -> list[dict[str, str]]:
        pipelines = list(self.pipelines.values())
        for pipeline in pipelines:
            pipeline["type"] = "default"
        return pipelines

    def _get_user_pipelines(self, user: User) -> list[dict[str, str]]:
        pipelines = Pipeline.objects.filter(owner=user, is_anonymous=False)
        return [
            {
                "id": pipeline.name,
                "type": "user",
                "content": Path(
                    pipeline.config_path
                ).read_text(encoding="utf-8"),
            }
            for pipeline in pipelines
        ]

    def get(self, request: Request) -> Response:
        pipelines = self._get_default_pipelines()
        if request.user and request.user.is_authenticated:
            pipelines = pipelines + self._get_user_pipelines(request.user)

        return Response(
            pipelines,
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
            load_pipeline_from_yaml(content, self.grr)
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

        preview_data = columns_file_preview(
            file, request.data.get("separator"))
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
        variant = request.data["variant"]
        assert isinstance(variant, dict)

        if "pipeline" not in request.data:
            return Response(
                {"reason": "Pipeline not provided!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        pipeline_id = request.data["pipeline"]
        if not isinstance(pipeline_id, str):
            return Response(
                {"reason": "Invalid pipeline provided!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        pipeline = self.lru_cache.get_pipeline(pipeline_id)

        if pipeline is None:
            try:
                pipeline_config = self._get_pipeline_yaml(
                    pipeline_id, request.user)
            except ValueError as e:
                return Response(
                    {"reason": str(e)},
                    status=views.status.HTTP_400_BAD_REQUEST,
                )

            pipeline = self.lru_cache.put_pipeline(
                pipeline_id, load_pipeline_from_yaml(pipeline_config, self.grr)
            )

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
        except (FileNotFoundError, ValueError):
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
        return HttpResponseRedirect(f"{redirect_uri}/login")
