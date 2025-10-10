from __future__ import annotations

from django.conf import settings
from datetime import timedelta
from django.contrib.auth.models import AbstractUser
from django.db import models
from typing import cast
import uuid
from django.utils import timezone


class User(AbstractUser):
    email = models.EmailField(("email address"), unique=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def change_password(self, new_password: str) -> None:
        self.set_password(new_password)
        self.save()

    def activate(self) -> None:
        self.is_active = True
        self.save()


class Job(models.Model):
    class Status(models.IntegerChoices):
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
    created = models.DateTimeField(auto_now_add=True)
    status = models.IntegerField(choices=Status, default=Status.WAITING)

    owner = models.ForeignKey(
        'web_annotation.User', related_name='jobs', on_delete=models.CASCADE)


class BaseVerificationCode(models.Model):
    """Base class for temporary codes for verifying the user without login."""

    path: models.Field = models.CharField(max_length=255, unique=True)
    user: models.Field = models.OneToOneField(
        User, on_delete=models.CASCADE)
    created_at: models.Field = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return str(self.path)

    def validate(self) -> bool:
        raise NotImplementedError

    class Meta:  # pylint: disable=too-few-public-methods
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
        db_table = "account_confirmation_codes"

    def validate(self) -> bool:
        # pylint: disable=import-outside-toplevel
        return True
