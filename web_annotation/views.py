from django.contrib.auth.models import User
from rest_framework import permissions, views, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from web_annotation.serializers import UserSerializer

import pathlib
import settings
import magic


class FileUploadView(views.APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        filename = request.FILES["data"].name
        content = request.FILES["data"].read().decode()
        if "Variant Call Format" not in magic.from_buffer(content):
            return Response(status=views.status.HTTP_400_BAD_REQUEST)
        pathlib.Path(settings.JOB_INPUT_STORAGE_DIR, filename).write_text(content)
        return Response(status=views.status.HTTP_204_NO_CONTENT)


class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
