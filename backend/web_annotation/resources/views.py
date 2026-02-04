from rest_framework import status
from rest_framework.views import Request, Response
from dae.genomic_resources.repository import GenomicResource
from collections.abc import Iterable
from web_annotation.annotation_base_view import AnnotationBaseView


class ResourcesAPIView(AnnotationBaseView):
    SUPPORTED_RESOURCE_TYPES = {
        "gene_score", "position_score",
        "gene_set_collection", "genome",
        "gene_models", "allele_score",
        "liftover_chain",
    }


class Resources(ResourcesAPIView):
    """
    API endpoint that allows resources to be searched.
    """

    def get(self, request: Request) -> Response:
        """Search for resources based on query parameters."""
        query_params = request.query_params

        resources: Iterable[GenomicResource] = filter(
            lambda resource: resource.get_type()
            in self.SUPPORTED_RESOURCE_TYPES,
            self._grr.get_all_resources(),
        )

        # Filter by type if provided
        resource_type = query_params.get("type")

        if resource_type:
            assert isinstance(resource_type, str)
            resources = filter(
                lambda resource: resource.get_type() == resource_type,
                resources,
            )

        # Filter by name if provided
        search = query_params.get("search")

        if search:
            assert isinstance(search, str)
            resources = filter(
                lambda resource: (
                    search.lower() in resource.resource_id.lower()
                ),
                resources,
            )

        output = [resource.resource_id for resource in resources]

        return Response(output, status=status.HTTP_200_OK)


class ResourceTypes(ResourcesAPIView):
    """
    API endpoint that allows resource types to be listed.
    """

    def get(self, request: Request) -> Response:
        """List all available resource types."""
        return Response(
            list(self.SUPPORTED_RESOURCE_TYPES),
            status=status.HTTP_200_OK,
        )
