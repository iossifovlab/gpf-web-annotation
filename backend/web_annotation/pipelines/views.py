"""Views for pipeline creation and manipulation."""
import logging
from pathlib import Path
import time
from dae.annotation.annotation_config import (
    AnnotationConfigParser,
    AnnotationConfigurationError,
)
from dae.annotation.annotation_factory import load_pipeline_from_yaml
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.http import QueryDict
from rest_framework import permissions
from rest_framework import views
from rest_framework.request import MultiValueDict
from rest_framework.views import Request, Response
from web_annotation.annotation_base_view import AnnotationBaseView
from web_annotation.models import Pipeline, User


logger = logging.getLogger(__name__)


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

        assert self.load_pipeline(pipeline.name, request.user) is not None

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
            "pipeline": Path(pipeline.config_path).read_text("utf-8"),
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


class PipelineValidation(AnnotationBaseView):
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
