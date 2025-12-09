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
from rest_framework import views
from rest_framework.request import MultiValueDict
from rest_framework.views import Request, Response
from web_annotation.annotation_base_view import AnnotationBaseView
from web_annotation.models import User


logger = logging.getLogger(__name__)


class UserPipeline(AnnotationBaseView):
    """View for saving user annotation pipelines."""

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

        pipeline_id = request.data.get("id")
        temporary = False

        pipeline_name = request.data.get("name")
        if not pipeline_id and not pipeline_name:
            pipeline_name = f'pipeline-{int(time.time())}.yaml'
            temporary = True

        if not temporary and pipeline_name in self.grr_pipelines:
            return Response(
                {"reason": (
                    "Pipeline with such name cannot be created or updated!"
                )},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        config_filename = f'{pipeline_name}.yaml'

        if pipeline_id:  # Update
            user_pipelines = request.user.pipeline_class.objects.filter(
                owner=request.user,
                pk=int(pipeline_id),
            )
            pipeline = user_pipelines[0]
            config_path = Path(str(pipeline.config_path))
            user_pipelines_count = user_pipelines.count()
            if user_pipelines_count > 1:
                return Response(
                    {"reason": "More than one pipeline share the same ID!"},
                    status=views.status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
        else:  # Create
            assert pipeline_name is not None
            config_path = Path(
                settings.ANNOTATION_CONFIG_STORAGE_DIR,
                request.user.identifier,
                config_filename,
            )
            pipeline = request.user.pipeline_class(
                name=pipeline_name,
                config_path=config_path,
                owner=request.user.as_owner,
                is_temporary=temporary,
            )

        pipeline_or_response = self._save_user_pipeline(
            request, config_path,
        )
        if isinstance(pipeline_or_response, Response):
            return pipeline_or_response

        pipeline.save()

        assert self.load_pipeline(
            pipeline.table_id(), request.user) is not None

        return Response(
            {"id": str(pipeline.pk)},
            status=views.status.HTTP_200_OK,
        )

    def get(self, request: Request) -> Response:
        """Get user annotation pipeline"""
        pipeline_id = request.query_params.get("id")
        if not pipeline_id:
            return Response(
                {"reason": "Pipeline ID not provided!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        pipeline = request.user.pipeline_class.objects.get(
            owner=request.user,
            pk=pipeline_id,
        )

        if not pipeline:
            return Response(
                {"reason": "Pipeline name not recognized!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        response = {
            "id": pipeline_id,
            "name": pipeline.name,
            "owner": pipeline.owner.identifier,
            "pipeline": Path(pipeline.config_path).read_text("utf-8"),
        }

        return Response(response, status=views.status.HTTP_200_OK)

    def delete(self, request: Request) -> Response:
        """Delete user annotation pipeline"""
        pipeline_id = request.query_params.get("id")
        if not pipeline_id:
            return Response(
                {"reason": "Pipeline name not provided!"},
                status=views.status.HTTP_400_BAD_REQUEST,
            )

        pipeline = request.user.pipeline_class.objects.filter(
            owner=request.user,
            pk=pipeline_id,
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

    def _get_grr_pipelines(self) -> list[dict[str, str]]:
        return [
            {
                "id": pipeline["id"],
                "type": "default",
                "name": pipeline["id"],
                "content": pipeline["content"],
            }
            for pipeline in self.grr_pipelines.values()
        ]

    def _get_user_pipelines(self, user: User) -> list[dict[str, str]]:
        pipelines = user.pipeline_class.objects.filter(
            owner=user, is_temporary=False,
        )
        return [
            {
                "id": str(pipeline.pk),
                "name": pipeline.name,
                "type": "user",
                "content": Path(
                    pipeline.config_path
                ).read_text(encoding="utf-8"),
            }
            for pipeline in pipelines
        ]

    def get(self, request: Request) -> Response:
        pipelines = self._get_grr_pipelines()
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
