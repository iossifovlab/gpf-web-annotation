from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login
from django.conf import settings
from django.http.response import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, views
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.response import Response
from rest_framework import generics

from web_annotation.serializers import JobSerializer, UserSerializer
from web_annotation.models import Job
from web_annotation.permissions import IsOwner, has_job_permission

import time
import pathlib
import magic


class JobAll(generics.ListAPIView):
    queryset = Job.objects.all()
    serializer_class = JobSerializer
    permission_classes = [permissions.IsAdminUser]


class JobList(generics.ListAPIView):
    def get_queryset(self):
        return Job.objects.filter(owner=self.request.user)

    serializer_class = JobSerializer
    permission_classes = [permissions.IsAuthenticated]


class JobDetail(generics.RetrieveAPIView):
    queryset = Job.objects.all()
    serializer_class = JobSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]


class JobCreate(views.APIView):
    parser_classes = [MultiPartParser]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        job_name = f"job-{int(time.time())}"

        # Handle annotation config file
        filename = f"{job_name}.yaml"
        content = request.FILES["config"].read()
        if "ASCII text" not in magic.from_buffer(content):
            return Response(status=views.status.HTTP_400_BAD_REQUEST)
        # TODO Verify validity of config
        config_path = pathlib.Path(settings.ANNOTATION_CONFIG_STORAGE_DIR, filename)
        config_path.write_text(content.decode())

        # Handle input VCF file
        filename = f"{job_name}.vcf"
        content = request.FILES["data"].read()
        if "Variant Call Format" not in magic.from_buffer(content):
            return Response(status=views.status.HTTP_400_BAD_REQUEST)
        # TODO Verify if valid VCF (?)
        input_path = pathlib.Path(settings.JOB_INPUT_STORAGE_DIR, filename)
        input_path.write_text(content.decode())

        result_path = pathlib.Path(settings.JOB_RESULT_STORAGE_DIR, filename)

        # Create Job model instance
        job = Job(input_path=input_path,
                  config_path=config_path,
                  result_path=result_path,
                  owner=request.user)
        job.save()

        return Response(status=views.status.HTTP_204_NO_CONTENT)


class JobGetFile(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk: int, file: str):
        job = get_object_or_404(Job, id=pk)
        if not has_job_permission(job, request.user):
            return Response(status=views.status.HTTP_403_FORBIDDEN)

        if file == "input":
            file_path = pathlib.Path(job.input_path)
        elif file == "config":
            file_path = pathlib.Path(job.config_path)
        elif file == "result":
            file_path = pathlib.Path(job.result_path)
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


class Login(views.APIView):
    parser_classes = [JSONParser]

    def post(self, request):
        if "username" not in request.data or "password" not in request.data:
            return Response(status=views.status.HTTP_400_BAD_REQUEST)

        username = request.data["username"]
        password = request.data["password"]

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response(status=views.status.HTTP_400_BAD_REQUEST)

        login(request, user)
        return Response(status=views.status.HTTP_200_OK)


class Registration(views.APIView):
    parser_classes = [JSONParser]

    def post(self, request):
        if (
            "username" not in request.data
            or "email" not in request.data
            or "password" not in request.data
        ):
            return Response(status=views.status.HTTP_400_BAD_REQUEST)

        username = request.data["username"]
        email = request.data["email"]
        password = request.data["password"]

        if User.objects.filter(username=username).exists():
            return Response(status=views.status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email=email).exists():
            return Response(status=views.status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username, email, password)
        user.save()
        return Response(status=views.status.HTTP_200_OK)
