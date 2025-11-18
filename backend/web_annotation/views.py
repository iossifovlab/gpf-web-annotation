# pylint: disable=too-many-lines
"""View classes for web annotation."""
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any, cast
from dae.genomic_resources.repository import GenomicResource

from dae.annotation.annotatable import VCFAllele
from dae.annotation.annotation_config import (
    AnnotationConfigParser,
    AnnotationConfigurationError,
    AttributeInfo,
)
from dae.annotation.annotation_factory import (
    load_pipeline_from_yaml,
)
from dae.annotation.annotation_pipeline import Annotator
from dae.annotation.gene_score_annotator import GeneScoreAnnotator
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
from django.db.models import QuerySet
from django.http import HttpRequest
from django.http.response import (
    HttpResponse,
    HttpResponseRedirect,
)
from django.shortcuts import render
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.http import last_modified
from rest_framework import generics, permissions, views
from rest_framework.parsers import JSONParser
from rest_framework.request import MultiValueDict, QueryDict, Request
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from web_annotation.utils import (
    PasswordForgottenForm,
    ResetPasswordForm,
    calculate_used_disk_space,
    check_request_verification_path,
    convert_size,
    deauthenticate,
    reset_password,
    verify_user,
)

from web_annotation.annotation_base_view import AnnotationBaseView

from .models import (
    AccountConfirmationCode,
    AlleleQuery,
    BaseVerificationCode,
    Job,
    Pipeline,
    ResetPasswordCode,
    User,
)
from .serializers import AlleleSerializer, UserSerializer

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


class AlleleHistory(generics.ListAPIView):
    """View for managing a user's allele annotation history."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AlleleSerializer

    def get_queryset(self) -> QuerySet:
        return AlleleQuery.objects.filter(owner=self.request.user)

    def delete(self, request: Request) -> Response:
        """Delete user allele annotation query from history"""
        query_id = request.query_params.get("id")
        if not query_id:
            return Response(
                {"reason": "Allele query ID must be provided!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        allele_query = AlleleQuery.objects.filter(
            id=query_id,
            owner=request.user,
        )

        if allele_query.count() == 0:
            return Response(
                {"reason": "Allele query id not recognized!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        allele_query.delete()

        return Response(status=views.status.HTTP_204_NO_CONTENT)


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
        return cast(int, settings.QUOTAS["daily_jobs"])

    def get_user_filesize_limit(self, user: User) -> str | None:
        """Return the file size limit for a user."""
        if user.is_superuser:
            return None
        return cast(str, settings.QUOTAS["filesize"])

    def get_user_variant_limit(self, user: User) -> int | None:
        """Return the variant count limit for a user."""
        if user.is_superuser:
            return None
        return cast(int, settings.QUOTAS["variant_count"])

    def get_user_jobs_left(self, user: User) -> int | None:
        """Return the number of jobs left for a user today."""
        if user.is_superuser:
            return None
        today = timezone.now().replace(
            hour=0, minute=0, second=0, microsecond=0)
        jobs_made = Job.objects.filter(
            created__gte=today, owner__exact=user.pk)
        daily_limit = cast(int, settings.QUOTAS["daily_jobs"])
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
                    "disk_space": (
                        f"{calculate_used_disk_space(user) // 10**6}MB / "
                        f"{convert_size(
                            str(settings.QUOTAS["disk_space"])
                        ) // 10**6}MB"
                    ),
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

        if (
            request.user
            and request.user.is_authenticated
            and isinstance(request.user, User)
        ):
            allele_query = AlleleQuery(
                allele=(
                    f"{variant['chrom']} {variant['pos']} "
                    f"{variant['ref']} {variant['alt']}"
                ),
                owner=request.user,
            )
            if AlleleQuery.objects.filter(
                allele=allele,
                owner=request.user,
            ).first() is None:
                allele_query = AlleleQuery(
                    allele=allele,
                    owner=request.user,
                )
                allele_query.save()

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
