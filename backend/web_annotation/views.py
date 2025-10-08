import time
import logging
from pathlib import Path
from typing import cast, Any

import magic
from pysam import VariantFile

from django.contrib.auth import authenticate, login, logout
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.http.response import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, views, generics
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.request import Request
from rest_framework.response import Response

from dae.annotation.annotation_config import AnnotationConfigParser, \
    AnnotationConfigurationError
from dae.annotation.annotation_factory import load_pipeline_from_grr
from dae.annotation.annotation_pipeline import AnnotationPipeline
from dae.genomic_resources.genomic_scores import build_score_from_resource
from dae.gene_scores.gene_scores import build_gene_score_from_resource
from dae.annotation.annotatable import VCFAllele
from dae.genomic_resources.repository_factory import \
    build_genomic_resource_repository
from dae.genomic_resources.repository import GenomicResourceRepo, \
    GenomicResource
from dae.genomic_resources.implementations.annotation_pipeline_impl import \
    AnnotationPipelineImplementation

from .serializers import JobSerializer, UserSerializer
from .models import Job, User
from .permissions import IsOwner, has_job_permission
from .tasks import create_annotation

logger = logging.getLogger(__name__)


def get_histogram_genomic_score(
    resource: GenomicResource, score: str,
) -> dict[str, Any]:
    if resource.get_type() not in [
        "allele_score", "position_score",
    ]:
        raise ValueError(f"{resource.resource_id} is not a genomic score!")
    return build_score_from_resource(
        resource).get_score_histogram(score).to_dict()

def get_histogram_gene_score(
    resource: GenomicResource, score: str,
) -> dict[str, Any]:
    if resource.get_type() != "gene_score":
        raise ValueError(f"{resource.resource_id} is not a genomic score!")
    return build_gene_score_from_resource(
        resource).get_score_histogram(score).to_dict()


def get_histogram_not_supported(
    resource: GenomicResource, score: str,
) -> dict[str, Any]:
    return {}


HISTOGRAM_GETTERS = {
    "allele_score": get_histogram_genomic_score,
    "position_score": get_histogram_genomic_score,
    "gene_score": get_histogram_gene_score,
}


def get_pipelines(grr: GenomicResourceRepo) -> dict[str, dict[str, str]]:
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
    if (
        getattr(settings, "GENOME_PIPELINES") is None
        or settings.GENOME_PIPELINES is None
    ):
        return {}
    pipelines: dict[str, AnnotationPipelineImplementation] = {}
    for genome, pipeline_id in settings.GENOME_PIPELINES.items():
        pipeline_resource = grr.get_resource(pipeline_id)
        pipeline = load_pipeline_from_grr(grr, pipeline_resource)
        pipelines[genome] = pipeline
    return pipelines


GRR = build_genomic_resource_repository(file_name=settings.GRR_DEFINITION)
PIPELINES = get_pipelines(GRR)


class AnnotationBaseView(views.APIView):
    def __init__(self) -> None:
        super().__init__()
        self._grr = GRR
        self.pipelines = PIPELINES
        self.genome_pipelines = get_genome_pipelines(self._grr)
        self.result_storage_dir = Path(settings.JOB_RESULT_STORAGE_DIR)

    @property
    def grr(self) -> GenomicResourceRepo:
        return self.get_grr()

    def get_grr(self) -> GenomicResourceRepo:
        return self._grr

    def get_grr_definition(self) -> Path | None:
        path = settings.GRR_DEFINITION
        if path is None:
            return path
        return Path(path)

    def get_genome_pipeline(
        self, genome: str,
    ) -> AnnotationPipeline:
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
    queryset = Job.objects.all()
    serializer_class = JobSerializer
    permission_classes = [permissions.IsAdminUser]


class JobList(generics.ListAPIView):
    def get_queryset(self):
        return Job.objects.filter(owner=self.request.user)

    serializer_class = JobSerializer
    permission_classes = [permissions.IsAuthenticated]


class JobDetail(generics.RetrieveAPIView, generics.DestroyAPIView):
    queryset = Job.objects.all()
    serializer_class = JobSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]


class JobCreate(AnnotationBaseView):
    parser_classes = [MultiPartParser]
    permission_classes = [permissions.IsAuthenticated]

    def check_valid_upload_size(self, file: UploadedFile, user: User) -> bool:
        if user.is_superuser:
            return True
        assert file.size is not None
        return file.size < self._convert_size(settings.LIMITS["filesize"])

    def check_if_user_can_create(self, user: User) -> bool:
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
        if user.is_superuser:
            return True
        return len(list(file.fetch())) < settings.LIMITS["variant_count"]

    def post(self, request: Request) -> Response:
        if not self.check_if_user_can_create(request.user):
            return Response(
                {"reason": "Daily job limit reached!"},
                status=views.status.HTTP_403_FORBIDDEN,
            )
        job_name = f"job-{int(time.time())}"

        assert request.data is not None

        config_filename = f"{job_name}.yaml"
        if "pipeline" in request.data:
            pipeline_id = request.data["pipeline"]
            if pipeline_id not in self.pipelines:
                return Response(status=views.status.HTTP_404_NOT_FOUND)
            content = self.pipelines[pipeline_id]["content"]
        else:
            # Handle annotation config file
            raw_content = request.FILES["config"].read()
            try:
                content = raw_content.decode()
                if "ASCII text" not in magic.from_buffer(content):
                    return Response(status=views.status.HTTP_400_BAD_REQUEST)
            except UnicodeDecodeError:
                return Response(
                    {"reason": "Invalid pipeline configuration file"},
                    status=views.status.HTTP_400_BAD_REQUEST,
                )

        try:
            AnnotationConfigParser.parse_str(content, grr=self.grr)
        except (AnnotationConfigurationError, KeyError) as e:
            return Response(
                {"reason": str(e)},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        # TODO Verify validity of config
        # Handle input VCF file
        data_filename = f"{job_name}.vcf"
        uploaded_file = request.FILES["data"]
        if not self.check_valid_upload_size(uploaded_file, request.user):
            return Response(
                status=views.status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

        try:
            vcf = uploaded_file.read().decode()
        except UnicodeDecodeError:
            return Response(
                {"reason": "Invalid VCF file"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )
        input_path = Path(settings.JOB_INPUT_STORAGE_DIR, data_filename)
        input_path.parent.mkdir(parents=True, exist_ok=True)
        input_path.write_text(vcf)

        try:
            vcf = VariantFile(str(input_path.absolute()), "r")
        except ValueError:
            return Response(
                {"reason": "Invalid VCF file"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        if not self.check_variants_limit(vcf, request.user):
            return Response(
                status=views.status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

        config_path = Path(
            settings.ANNOTATION_CONFIG_STORAGE_DIR, config_filename)
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(content)


        result_path = Path(settings.JOB_RESULT_STORAGE_DIR, data_filename)

        # Create Job model instance
        job = Job(input_path=input_path,
                  config_path=config_path,
                  result_path=result_path,
                  owner=request.user)
        job.save()

        create_annotation.delay(
            job.pk,
            str(self.result_storage_dir),
            str(self.get_grr_definition()),
        )

        return Response(status=views.status.HTTP_204_NO_CONTENT)


class JobGetFile(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request, pk: int, file: str) -> Response:
        job = get_object_or_404(Job, id=pk)
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
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]


class UserDetail(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]


class UserInfo(views.APIView):
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
    def get(self, request: Request) -> Response:
        logout(request)
        return Response(views.status.HTTP_204_NO_CONTENT)


class Login(views.APIView):
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
    parser_classes = [JSONParser]

    def post(self, request: Request) -> Response:
        if "email" not in request.data:
            return Response(
                {"error": "An email is required to register"},
                status=views.status.HTTP_400_BAD_REQUEST)
        if "password" not in request.data:
            return Response(
                {"error": "A password is required to register"},
                status=views.status.HTTP_400_BAD_REQUEST)

        email = request.data["email"]
        password = request.data["password"]

        if User.objects.filter(email=email).exists():
            return Response(
                {"error": "This email is already in use"},
                status=views.status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(email, email, password)
        user.save()
        return Response(status=views.status.HTTP_200_OK)


class ListPipelines(AnnotationBaseView):

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

        try:
            AnnotationConfigParser.parse_str(content, grr=self.grr)
        except (AnnotationConfigurationError, KeyError) as e:
            return Response(
                {"reason": str(e)},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        return Response(status=views.status.HTTP_200_OK)


class ListGenomePipelines(AnnotationBaseView):

    def get(self, request: Request) -> Response:
        return Response([], status=views.status.HTTP_200_OK)


class SingleAnnotation(AnnotationBaseView):
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
                resource = self.grr.get_resource(
                    list(annotator.resource_ids)[0])
                histogram_getter = HISTOGRAM_GETTERS.get(
                    resource.get_type(), get_histogram_not_supported,
                )
                histogram_data = histogram_getter(
                    resource, attribute_info.source
                )
                attributes.append({
                    "name": attribute_info.name,
                    "description": attribute_info.description,
                    "result": {
                        "value": str(result[attribute_info.name]),
                        "histogram": histogram_data,
                    },
                })
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
