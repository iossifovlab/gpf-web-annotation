from django.conf import settings
from django.db import models


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
