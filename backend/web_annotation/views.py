import time
import logging
from pathlib import Path
from typing import cast

import magic
from pysam import VariantFile

from django import forms
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.http import HttpRequest
from django.http.response import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from rest_framework import permissions, views, generics
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.request import Request
from rest_framework.response import Response
from django.contrib.sessions.models import Session

from dae.annotation.annotation_config import AnnotationConfigParser, \
    AnnotationConfigurationError
from dae.genomic_resources.repository_factory import \
    build_genomic_resource_repository
from dae.genomic_resources.repository import GenomicResourceRepo
from dae.genomic_resources.implementations.annotation_pipeline_impl import \
    AnnotationPipelineImplementation

from .serializers import JobSerializer, UserSerializer
from .models import BaseVerificationCode, Job, ResetPasswordCode, User
from .permissions import IsOwner, has_job_permission
from .tasks import create_annotation, send_email

logger = logging.getLogger(__name__)


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


GRR = build_genomic_resource_repository()
PIPELINES = get_pipelines(GRR)


class AnnotationBaseView(views.APIView):
    def __init__(self) -> None:
        super().__init__()
        self._grr = GRR
        self.pipelines = PIPELINES
        self.result_storage_dir = Path(settings.JOB_RESULT_STORAGE_DIR)

    @property
    def grr(self) -> GenomicResourceRepo:
        return self.get_grr()

    def get_grr(self) -> GenomicResourceRepo:
        return self._grr

    def get_grr_directory(self) -> Path | None:
        if getattr(settings, "GRR_DIRECTORY") is not None:
            return cast(Path, settings.GRR_DIRECTORY)
        if self.grr.definition is None:
            return None
        if self.grr.definition["type"] == "dir":
            return Path(self.grr.definition["directory"])
        return None

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
            job.pk, str(self.result_storage_dir), self.get_grr_directory())

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


class ForgotPassword(views.APIView):  # USE
    """View for forgotten password."""

    def get(self, request: Request) -> HttpResponse:
        form = WdaePasswordForgottenForm()
        return render(
            cast(HttpRequest, request),
            "forgotten-password.html",
            {"form": form, "show_form": True},
        )

    def post(self, request: Request) -> HttpResponse:
        """Send a reset password email to the user."""
        data = request.data
        form = WdaePasswordForgottenForm(data)  # pyright: ignore
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
                        "message": "User is not a WdaeUser",
                        "message_type": "warn",
                        "show_form": True,
                    },
                    status=views.status.HTTP_400_BAD_REQUEST,
                )
            reset_password(user)
            deauthenticate(user)

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

class WdaePasswordForgottenForm(forms.Form):
    email = forms.EmailField(
        label="Email",
        max_length=254,
        widget=forms.EmailInput(attrs={"autocomplete": "email"}),
    )

def reset_password(user: User, by_admin: bool = False) -> None:
    verif_code = ResetPasswordCode.create(user)
    send_reset_email(user, verif_code, by_admin)

def deauthenticate(user: User) -> None:
    all_sessions = Session.objects.all()
    for session in all_sessions:
        session_data = session.get_decoded()
        if user.pk == session_data.get("_auth_user_id"):
            session.delete()

def send_reset_email(
    user: User, verif_path: BaseVerificationCode,
    by_admin: bool = False,
) -> None:
    """Return dict with subject and message of the email."""
    # pylint: disable=import-outside-toplevel
    email = _create_reset_mail(
        settings.EMAIL_VERIFICATION_ENDPOINT,  # type: ignore
        settings.EMAIL_VERIFICATION_RESET_PATH,
        str(verif_path.path),
        by_admin,
    )
    send_email.delay(email["subject"], email["message"], [user.email])

def _create_reset_mail(
    endpoint: str, path: str, verification_path: str, by_admin: bool = False,
) -> dict[str, str]:
    message = (
        "Hello. You have requested to reset your password for "
        "your GPF account. To do so, please follow the link below:\n {link}\n"
        "If you did not request for your GPF account password to be reset, "
        "please ignore this email."
    )
    if by_admin:
        message = (
            "Hello. Your password has been reset by an admin. Your old "
            "password will not work. To set a new password in "
            "GPF: Genotype and Phenotype in Families "
            "please follow the link below:\n {link}"
        )
    email_settings = {
        "subject": "GPF: Password reset request",
        "initial_message": message,
        "endpoint": endpoint,
        "path": path,
        "verification_path": verification_path,
    }

    return _build_email_template(email_settings)

def _build_email_template(email_settings: dict[str, str]) -> dict[str, str]:
    subject = email_settings["subject"]
    message = email_settings["initial_message"]
    path = email_settings["path"].format(email_settings["verification_path"])

    message = message.format(link=f"{email_settings['endpoint']}{path}")

    return {"subject": subject, "message": message}
