from django.contrib.auth.models import User
from django.conf import settings
from rest_framework import permissions, views, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework import generics

from web_annotation.serializers import JobSerializer, UserSerializer
from web_annotation.models import Job

import time
import pathlib
import magic


class JobList(generics.ListAPIView):
    queryset = Job.objects.all()
    serializer_class = JobSerializer


class JobDetail(generics.RetrieveAPIView):
    queryset = Job.objects.all()
    serializer_class = JobSerializer


class JobCreate(views.APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        job_name = f"job-{int(time.time())}"

        # Handle annotation config file
        filename = f"{job_name}.yaml"
        content = request.FILES["config"].read().decode()
        if "ASCII text" not in magic.from_buffer(content):
            return Response(status=views.status.HTTP_400_BAD_REQUEST)
        # TODO Verify validity of config
        config_path = pathlib.Path(settings.ANNOTATION_CONFIG_STORAGE_DIR, filename)
        config_path.write_text(content)

        # Handle input VCF file
        filename = f"{job_name}.vcf"
        content = request.FILES["data"].read().decode()
        if "Variant Call Format" not in magic.from_buffer(content):
            return Response(status=views.status.HTTP_400_BAD_REQUEST)
        # TODO Verify if valid VCF (?)
        input_path = pathlib.Path(settings.JOB_INPUT_STORAGE_DIR, filename)
        input_path.write_text(content)

        result_path = pathlib.Path(settings.JOB_RESULT_STORAGE_DIR, filename)

        # Create Job model instance
        job = Job(input_path=input_path,
                  config_path=config_path,
                  result_path=result_path)
        job.save()

        return Response(status=views.status.HTTP_204_NO_CONTENT)


class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
