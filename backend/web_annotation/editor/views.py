from typing import Any
from dae.annotation.annotation_config import AnnotatorInfo
from dae.annotation.annotation_pipeline import AnnotationPipeline
from rest_framework.views import Request, Response, status
from dae.annotation.annotation_factory import get_annotator_factory, get_available_annotator_types

from web_annotation.annotation_base_view import AnnotationBaseView


class EditorView(AnnotationBaseView):
    """Base view for editor API endpoints."""

    def _get_annotator_types(self) -> list[str]:
        """Get all available annotator types from the DAE registry."""

        return get_available_annotator_types()

    def _get_annotator_config_template(
        self, annotator_type: str,
    ) -> dict[str, Any]:
        """
        Temporary method to get annotator config template
        until it is implemented internally in DAE.
        """

        if annotator_type == "position_score":
            return {
                "annotator_type": "position_score",
                "resource_id": {
                    "field_type": "resource",
                    "resource_type": "position_score",
                },
                "input_annotatable": {
                    "field_type": "string",
                },
            }

        raise KeyError(f"Unknown annotator_type: {annotator_type}")


class AnnotatorConfig(EditorView):
    def post(self, request: Request) -> Response:
        data = request.data
        assert isinstance(data, dict)
        if "annotator_type" not in data:
            return Response(
                {"error": "annotator_type is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        annotator_type = data["annotator_type"]

        if not isinstance(annotator_type, str):
            return Response(
                {"error": "annotator_type must be a string"},
                status=status.HTTP_400_BAD_REQUEST
            )

        result = self._get_annotator_config_template(annotator_type)

        return Response(result, status=status.HTTP_200_OK)


class AnnotatorTypes(EditorView):
    def get(self, request: Request) -> Response:
        annotator_types = self._get_annotator_types()
        return Response(annotator_types, status=status.HTTP_200_OK)


class AnnotatorAttributes(EditorView):
    def post(self, request: Request) -> Response:
        assert isinstance(request.data, dict)
        data = dict(request.data)
        if "annotator_type" not in data:
            return Response(
                {"error": "annotator_type is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        annotator_type = data.pop("annotator_type")

        if not isinstance(annotator_type, str):
            return Response(
                {"error": "annotator_type must be a string"},
                status=status.HTTP_400_BAD_REQUEST
            )

        dummy_pipeline = AnnotationPipeline(self.get_grr())

        annotator_config = AnnotatorInfo(annotator_type, [], data)

        if annotator_type not in get_available_annotator_types():
            return Response(
                {"error": f"Unknown annotator_type: {annotator_type}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        factory = get_annotator_factory(annotator_type)
        annotator = factory(dummy_pipeline, annotator_config)
        import pdb; pdb.set_trace()

        return Response({}, status=status.HTTP_200_OK)


