"""Web annotation django models."""

from __future__ import annotations

import uuid
import os
import pathlib
from datetime import timedelta
from typing import cast

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """Model for user accounts."""
    email = models.EmailField(("email address"), unique=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def change_password(self, new_password: str) -> None:
        """Update user with new password."""
        self.set_password(new_password)
        self.save()

    def activate(self) -> None:
        """Enable a user's account."""
        self.is_active = True
        self.save()


class Pipeline(models.Model):
    """Model for saving user created pipeline configs"""
    name = models.CharField(max_length=1024, default="")
    config_path = models.FilePathField(
        path=settings.ANNOTATION_CONFIG_STORAGE_DIR)
    owner = models.ForeignKey(
        'web_annotation.User',
        related_name='pipelines',
        on_delete=models.CASCADE,
    )
    is_anonymous = models.BooleanField(default=False)

    def remove(self) -> None:
        """Diactivate a job and clean its resources."""
        os.remove(self.config_path)
        self.delete()


class Job(models.Model):
    """Model for storing base job data."""
    class Status(models.IntegerChoices):  # pylint: disable=too-many-ancestors
        """Class for job status."""
        WAITING = 1
        IN_PROGRESS = 2
        SUCCESS = 3
        FAILED = 4

    input_path = models.FilePathField(
        path=settings.JOB_INPUT_STORAGE_DIR)
    config_path = models.FilePathField(
        path=settings.ANNOTATION_CONFIG_STORAGE_DIR)
    result_path = models.FilePathField(
        path=settings.JOB_RESULT_STORAGE_DIR)
    name = models.IntegerField(default=0)
    reference_genome = models.CharField(max_length=1024, default="")
    created = models.DateTimeField(default=timezone.now)
    status = models.IntegerField(choices=Status, default=Status.WAITING)
    duration = models.FloatField(null=True, default=None)
    command_line = models.TextField(default="")
    annotation_type = models.CharField(max_length=1024, default="")

    owner = models.ForeignKey(
        'web_annotation.User', related_name='jobs', on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)

    def deactivate(self) -> None:
        """Diactivate a job and clean its resources."""
        self.is_active = False
        os.remove(self.input_path)
        os.remove(self.config_path)
        if pathlib.Path(self.result_path).exists():
            os.remove(self.result_path)
        self.save()


class JobDetails(models.Model):
    """Model for storing job details for tsv files."""
    class Meta:  # pylint: disable=too-few-public-methods
        """Meta class for details model."""
        constraints = [
            models.UniqueConstraint(fields=["job"], name="unique_job_details")
        ]
    col_chr = models.CharField(max_length=1024, default="")
    col_pos = models.CharField(max_length=1024, default="")
    col_ref = models.CharField(max_length=1024, default="")
    col_alt = models.CharField(max_length=1024, default="")
    col_pos_beg = models.CharField(max_length=1024, default="")
    col_pos_end = models.CharField(max_length=1024, default="")
    col_cnv_type = models.CharField(max_length=1024, default="")
    col_vcf_like = models.CharField(max_length=1024, default="")
    col_variant = models.CharField(max_length=1024, default="")
    col_location = models.CharField(max_length=1024, default="")
    separator = models.CharField(max_length=1, null=True)
    columns = models.TextField()
    job = models.ForeignKey(
        'web_annotation.Job', related_name='details', on_delete=models.CASCADE)


class BaseVerificationCode(models.Model):
    """Base class for temporary codes for verifying the user without login."""

    path: models.Field = models.CharField(max_length=255, unique=True)
    user: models.Field = models.OneToOneField(
        User, on_delete=models.CASCADE)
    created_at: models.Field = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return str(self.path)

    def validate(self) -> bool:
        """Check whether the code is valid."""
        raise NotImplementedError

    class Meta:  # pylint: disable=too-few-public-methods
        """Meta class for verification model."""
        abstract = True

    @classmethod
    def get_code(
        cls, user: User,
    ) -> BaseVerificationCode | None:
        """Get a verification code for a user."""
        try:
            # pylint: disable=no-member
            return cast(
                BaseVerificationCode,
                cls.objects.get(user=user))  # type: ignore
        except models.ObjectDoesNotExist:
            return None

    @classmethod
    def create(cls, user: User) -> BaseVerificationCode:
        """Create an email verification code."""
        try:
            # pylint: disable=no-member
            verif_code = cls.objects.get(user=user)  # type: ignore
        except models.ObjectDoesNotExist:
            # pylint: disable=no-member
            verif_code = cls.objects.create(  # type: ignore
                user=user, path=uuid.uuid4())
            return cast(BaseVerificationCode, verif_code)

        if verif_code.validate is not True:
            verif_code.delete()
            return cls.create(user)

        return cast(BaseVerificationCode, verif_code)


class ResetPasswordCode(BaseVerificationCode):
    """Class used for verification of password resets."""

    class Meta:  # pylint: disable=too-few-public-methods
        """Meta class for reset password codes."""
        db_table = "reset_password_verification_codes"

    def validate(self) -> bool:
        # pylint: disable=import-outside-toplevel
        max_delta = timedelta(
            hours=getattr(settings, "RESET_PASSWORD_TIMEOUT_HOURS", 24))
        if timezone.now() - self.created_at > max_delta:
            return False
        return True


class AccountConfirmationCode(BaseVerificationCode):
    """Class used for verification of password resets."""

    class Meta:  # pylint: disable=too-few-public-methods
        """Meta class for account confirmation codes."""
        db_table = "account_confirmation_codes"

    def validate(self) -> bool:
        # pylint: disable=import-outside-toplevel
        return True
