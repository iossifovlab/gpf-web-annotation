from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(("email address"), unique=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []


class Job(models.Model):
    class Status(models.IntegerChoices):
        WAITING = 1
        IN_PROGRESS = 2
        SUCCESS = 3
        FAILED = 4

    input_path = models.FilePathField(path=settings.JOB_INPUT_STORAGE_DIR)
    config_path = models.FilePathField(path=settings.ANNOTATION_CONFIG_STORAGE_DIR)
    result_path = models.FilePathField(path=settings.JOB_RESULT_STORAGE_DIR)
    created = models.DateTimeField(auto_now_add=True)
    status = models.IntegerField(choices=Status, default=Status.WAITING)

    owner = models.ForeignKey('web_annotation.User', related_name='jobs', on_delete=models.CASCADE)
