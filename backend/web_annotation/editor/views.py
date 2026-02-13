from typing import Any

import yaml
from rest_framework.views import Request, Response, status

from dae.annotation.annotation_config import AnnotationConfigParser, \
    AnnotatorInfo
from dae.annotation.annotation_factory import (
    get_annotator_factory, get_available_annotator_types,
)
from dae.annotation.effect_annotator import EffectAnnotatorAdapter

from web_annotation.annotation_base_view import AnnotationBaseView
from web_annotation.authentication import WebAnnotationAuthentication


class EditorView(AnnotationBaseView):
    """Base view for editor API endpoints."""

    def _get_annotator_types(self) -> list[str]:
        """Get all available annotator types from the DAE registry."""

        return [
            "position_score",
            "allele_score",
            "gene_score_annotator",
            "gene_set_annotator",
            "cnv_collection",
            "effect_annotator",
            "simple_effect_annotator",
            "liftover_annotator",
            "normalize_allele_annotator",
        ]

    def _get_annotator_config_template(
        self, annotator_type: str,
    ) -> dict[str, Any]:
        """
        Temporary method to get annotator config template
        until it is implemented internally in DAE.
        """

        if annotator_type not in get_available_annotator_types():
            raise ValueError(f"Unknown annotator_type: {annotator_type}")

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
        if annotator_type == "allele_score":
            return {
                "annotator_type": "allele_score",
                "resource_id": {
                    "field_type": "resource",
                    "resource_type": "allele_score",
                },
                "input_annotatable": {
                    "field_type": "string",
                },
            }
        if annotator_type == "gene_score_annotator":
            return {
                "annotator_type": "gene_score_annotator",
                "resource_id": {
                    "field_type": "resource",
                    "resource_type": "gene_score",
                },
                "input_gene_list": {
                    "field_type": "string",
                },
                "input_annotatable": {
                    "field_type": "string",
                },
            }
        if annotator_type == "gene_set_annotator":
            return {
                "annotator_type": "gene_set_annotator",
                "resource_id": {
                    "field_type": "resource",
                    "resource_type": "gene_set_collection",
                },
                "input_gene_list": {
                    "field_type": "string",
                },
                "input_annotatable": {
                    "field_type": "string",
                },
            }
        if annotator_type == "cnv_collection":
            return {
                "annotator_type": "cnv_collection",
                "resource_id": {
                    "field_type": "resource",
                    "resource_type": "cnv_collection",
                },
                "cnv_filter": {
                    "field_type": "string",
                },
                "input_annotatable": {
                    "field_type": "string",
                },
            }
        if annotator_type == "effect_annotator":
            return {
                "annotator_type": "effect_annotator",
                "gene_models": {
                    "field_type": "resource",
                    "resource_type": "gene_models",
                },
                "genome": {
                    "field_type": "resource",
                    "resource_type": "genome",
                },
                "input_annotatable": {
                    "field_type": "string",
                },
            }
        if annotator_type == "simple_effect_annotator":
            return {
                "annotator_type": "effect_annotator",
                "gene_models": {
                    "field_type": "resource",
                    "resource_type": "gene_models",
                },
                "input_annotatable": {
                    "field_type": "string",
                },
            }
        if annotator_type == "liftover_annotator":
            return {
                "annotator_type": "liftover_annotator",
                "chain": {
                    "field_type": "resource",
                    "resource_type": "liftover_chain",
                },
                "source_genome": {
                    "field_type": "resource",
                    "resource_type": "genome",
                },
                "target_genome": {
                    "field_type": "resource",
                    "resource_type": "genome",
                },
                "input_annotatable": {
                    "field_type": "string",
                },
            }
        if annotator_type == "normalize_allele_annotator":
            return {
                "annotator_type": "normalize_allele_annotator",
                "genome": {
                    "field_type": "resource",
                    "resource_type": "genome",
                },
                "input_annotatable": {
                    "field_type": "string",
                },
            }

        raise KeyError(f"Unknown annotator_type: {annotator_type}")


class AnnotatorConfig(EditorView):
    """View for annotator configuration templates."""
    def post(self, request: Request) -> Response:
        """POST method to get annotator config template."""
        assert isinstance(request.data, dict)
        data = {**request.data}
        if "annotator_type" not in data:
            return Response(
                {"error": "annotator_type is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        annotator_type = data.pop("annotator_type", None)

        if not isinstance(annotator_type, str):
            return Response(
                {"error": "annotator_type must be a string"},
                status=status.HTTP_400_BAD_REQUEST
            )

        result = self._get_annotator_config_template(annotator_type)

        for key, value in data.items():
            if key in result:
                result[key]["value"] = value

        return Response(result, status=status.HTTP_200_OK)


class AnnotatorTypes(EditorView):
    """View for available annotator types."""
    def get(self, request: Request) -> Response:
        """GET method to retrieve available annotator types."""
        annotator_types = self._get_annotator_types()
        return Response(annotator_types, status=status.HTTP_200_OK)


class AnnotatorAttributes(EditorView):
    """View for annotator attributes."""

    authentication_classes = [WebAnnotationAuthentication]

    def post(self, request: Request) -> Response:
        """POST method to get annotator attributes."""
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

        pipeline_id = data.pop("pipeline_id", None)
        if pipeline_id is None or not isinstance(pipeline_id, str):
            return Response(
                {"error": "A pipeline_id string is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        pipeline = self.get_pipeline(pipeline_id, request.user)

        data["work_dir"] = "/tmp"

        annotator_config = AnnotatorInfo(annotator_type, [], data)

        if annotator_type not in get_available_annotator_types():
            return Response(
                {"error": f"Unknown annotator_type: {annotator_type}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        factory = get_annotator_factory(annotator_type)
        annotator = factory(pipeline, annotator_config)
        annotator_info = annotator.get_info()
        annotator_type = annotator_info.type
        attributes = annotator_info.attributes
        result = []
        used_attributes = set()
        for attribute in attributes:
            used_attributes.add(attribute.source)
            if attribute.internal is None:
                attribute.internal = False
            result.append({
                "name": attribute.name,
                "source": attribute.source,
                "type": attribute.type,
                "internal": attribute.internal,
            })

        if annotator_type == "effect_annotator":
            assert isinstance(annotator, EffectAnnotatorAdapter)
            for attribute_desc in (
                annotator.attribute_descriptions.values()
            ):
                if attribute_desc.name in used_attributes:
                    continue
                result.append({
                    "name": attribute_desc.name,
                    "source": attribute_desc.name,
                    "type": attribute_desc.type,
                    "internal": attribute_desc.internal,
                })
                used_attributes.add(attribute_desc.name)

        return Response(result, status=status.HTTP_200_OK)


class AnnotatorYAML(EditorView):
    """View for annotator configuration in YAML format."""
    def post(self, request: Request) -> Response:
        """POST method to get annotator config in YAML format."""
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

        if annotator_type not in get_available_annotator_types():
            return Response(
                {"error": f"Unknown annotator_type: {annotator_type}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        _, annotator_configs = AnnotationConfigParser.parse_raw(
            [{annotator_type: data}])

        assert len(annotator_configs) == 1
        annotator_config = annotator_configs[0]

        return Response(
            yaml.safe_dump([annotator_config.to_dict()]),
            status=status.HTTP_200_OK,
        )


class ResourceAnnotators(EditorView):
    """View for annotators associated with a resource."""

    def get(self, request: Request) -> Response:
        """GET method to retrieve annotators associated with a resource."""
        resource_id = request.query_params.get("resource_id")
        if resource_id is None:
            return Response(
                {"error": "resource_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            resource = self.grr.get_resource(resource_id)
        except ValueError:
            return Response(
                {"error": f"Resource '{resource_id}' not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        configs = []

        for annotator_type in self._get_annotator_types():
            config = {
                "annotator_type": annotator_type,
            }
            matched = False
            try:
                template = self._get_annotator_config_template(annotator_type)
            except KeyError:
                continue
            for field_name, field in template.items():
                if isinstance(field, dict):
                    field_type = field.get("field_type")
                    if field_type is not None and field_type == "resource":
                        resource_type = field.get("resource_type")
                        if resource_type == resource.get_type():
                            matched = True
                            config[field_name] = resource_id
                            break

            if not matched:
                continue
            configs.append(config)

        return Response(configs, status=status.HTTP_200_OK)
