"""Module containing base view for annotation work."""
import logging
from pathlib import Path
from typing import cast
from dae.annotation.annotation_config import (
    AnnotationConfigParser,
    AnnotationConfigurationError,
)
from dae.annotation.annotation_factory import load_pipeline_from_yaml
from dae.annotation.annotation_pipeline import AnnotationPipeline
from dae.genomic_resources.implementations.annotation_pipeline_impl import (
    AnnotationPipelineImplementation,
)
from dae.genomic_resources.repository import GenomicResourceRepo
from dae.genomic_resources.repository_factory import (
    build_genomic_resource_repository,
)
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.http import QueryDict
from django.utils import timezone
import magic
from pysam import VariantFile
from rest_framework import views
from rest_framework.views import Request, Response
from rest_framework.request import MultiValueDict
import yaml

from web_annotation.executor import (
    TaskExecutor,
    ThreadedTaskExecutor,
)
from web_annotation.models import Job, Pipeline, User
from web_annotation.pipeline_cache import LRUPipelineCache

logger = logging.getLogger(__name__)

GRR = build_genomic_resource_repository(file_name=settings.GRR_DEFINITION_PATH)


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

        job_size = (
            input_path.stat().st_size + config_path.stat().st_size
        )

        job = Job(
            name=job_name,
            input_path=input_path,
            config_path=config_path,
            result_path=result_path,
            reference_genome=reference_genome,
            owner=request.user,
            annotation_type=annotation_type,
            disk_size=job_size,
        )
        return (job_name, pipeline, job)
