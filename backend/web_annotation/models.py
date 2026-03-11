"""Web annotation django models."""

from __future__ import annotations

import time
import uuid
import os
import pathlib
import logging
from datetime import timedelta
from typing import Any, cast

from django.conf import settings
from django.contrib.auth.models import AbstractUser, AnonymousUser
from django.db import models
from django.utils import timezone

from web_annotation.mail import send_email

logger = logging.getLogger(__name__)


class BaseUser():
    """Base user class for helper functions."""

    @property
    def job_class(self) -> type[BaseJob]:
        """Get job class used."""
        raise NotImplementedError

    @property
    def identifier(self) -> str:
        """Get identifier for user."""
        raise NotImplementedError

    @property
    def session_id(self) -> str:
        """Get session ID for user."""
        raise NotImplementedError

    def create_job(self, **kwargs: Any) -> BaseJob:
        """Create a new job for the user."""
        raise NotImplementedError

    def check_pipeline_owner(self, pipeline: BasePipeline) -> bool:
        """Check if user is owner of the pipeline."""
        raise NotImplementedError

    def get_socket_group(self) -> str:
        """Get socket group for user."""
        raise NotImplementedError

    def get_pipeline(self, pipeline_id: str) -> BasePipeline:
        """Get pipeline from respective table, checking ownership."""
        raise NotImplementedError

    def delete_pipelines(self) -> None:
        """Delete user pipelines."""
        return

    def as_owner(self) -> User:
        raise NotImplementedError

    def get_pipelines(self) -> list[BasePipeline]:
        """Get pipelines for user."""
        raise NotImplementedError

    def get_temporary_pipeline(
        self, session_id: str | None = None,
    ) -> BasePipeline | None:
        if session_id is None:
            session_id = self.session_id
        pipeline = TemporaryPipeline.objects.filter(  # type: ignore
            session_id=session_id).first()
        if pipeline is None:
            return None
        if session_id != self.session_id:
            raise ValueError("Session ID does not match user session!")
        return cast(BasePipeline, pipeline)


class UserWrapper(BaseUser):
    """Wrapper for user objects to implement BaseUser functions."""

    def __init__(self, user: User, session_id: str) -> None:
        self.user = user
        self._session_id = session_id

    @property
    def job_class(self) -> type[Job]:
        """Get job class used."""
        return self.user.job_class

    @property
    def identifier(self) -> str:
        """Get identifier for user."""
        return self.user.identifier

    @property
    def session_id(self) -> str:
        """Get session ID for user."""
        return self._session_id

    def create_job(self, **kwargs: Any) -> Job:
        """Create a new job for the user."""
        return self.user.create_job(**kwargs)

    def check_pipeline_owner(self, pipeline: BasePipeline) -> bool:
        """Check if user is owner of the pipeline."""
        return self.user.check_pipeline_owner(pipeline)

    def can_create(self) -> bool:
        """Check if a user is not limited by the daily quota."""
        return self.user.can_create()

    def generate_job_name(self) -> int:
        """Generate a new job name for the user."""
        return self.user.generate_job_name()

    def get_socket_group(self) -> str:
        """Get socket group for user."""
        return self.user.get_socket_group()

    def get_pipeline(self, pipeline_id: str) -> BasePipeline:
        """Get pipeline from respective table, checking ownership."""
        pipeline = Pipeline.objects.filter(  # type: ignore
            pk=int(pipeline_id),
        ).first()
        if pipeline is None:
            raise ValueError(f"Pipeline {pipeline_id} not found!")
        if not self.check_pipeline_owner(cast(BasePipeline, pipeline)):
            raise ValueError("User not authorized to access pipeline!")

        return cast(BasePipeline, pipeline)

    def get_pipelines(self) -> list[BasePipeline]:
        """Get pipelines for user."""
        pipelines = Pipeline.objects.filter(  # type: ignore
            owner=self.user.as_owner,
        )
        return list(pipelines)

    def delete_pipelines(self) -> None:
        """Delete user pipelines."""
        self.user.delete_pipelines()

    def delete_pipeline(self, pipeline_id: str) -> None:
        """Delete user pipelines."""
        self.user.delete_pipeline(pipeline_id)

    @property
    def is_superuser(self) -> bool:
        """Check if user is superuser."""
        return self.user.is_superuser

    @property
    def is_authenticated(self) -> bool:
        """Check if user is authenticated."""
        return self.user.is_authenticated

    def is_owner(self, job: Job) -> bool:
        return job.owner == self.user

    @property
    def is_staff(self) -> str:
        return self.user.is_staff

    @property
    def pk(self) -> int:
        return self.user.pk

    @property
    def email(self) -> str:
        return self.user.email

    def get_jobs(self) -> list[Job]:
        """Get user's jobs."""
        return self.user.get_jobs()

    @property
    def as_owner(self) -> User:
        return self.user.as_owner


class User(AbstractUser):
    """Model for user accounts."""
    email = models.EmailField(("email address"), unique=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    job_counter = models.IntegerField(default=0)

    @property
    def job_class(self) -> type[Job]:
        """Get job class used."""
        return Job

    @property
    def identifier(self) -> str:
        """Get identifier for user."""
        return self.email

    @property
    def as_owner(self) -> User:
        return self

    def is_owner(self, job: Job) -> bool:
        return job.owner == self

    def check_pipeline_owner(self, pipeline: BasePipeline) -> bool:
        """Check if user is owner of the pipeline."""
        assert isinstance(pipeline, Pipeline)
        return pipeline.owner == self.as_owner

    def change_password(self, new_password: str) -> None:
        """Update user with new password."""
        self.set_password(new_password)
        self.save()

    def get_socket_group(self) -> str:
        """Get socket group for user."""
        return str(self.pk)

    def activate(self) -> None:
        """Enable a user's account."""
        self.is_active = True
        self.save()

    def generate_job_name(self) -> int:
        job_count = self.job_class.objects.filter(owner=self).count()
        if job_count > self.job_counter:
            self.job_counter += job_count
        self.job_counter += 1
        self.save()
        return self.job_counter

    def create_job(self, **kwargs: Any) -> Job:
        """Create a new job for the user."""
        job = self.job_class(
            owner=self,
            **kwargs,
        )
        return job

    def get_jobs(self) -> list[Job]:
        """Get user's jobs."""
        jobs = self.job_class.objects.filter(
            owner=self.as_owner,
        )
        return list(jobs)

    def delete_jobs(self) -> None:
        """Get user's jobs."""
        jobs = self.job_class.objects.filter(
            owner=self.as_owner,
        )
        for job in jobs:
            job.deactivate()

    def delete_pipelines(self) -> None:
        """Delete user pipelines."""
        pipelines = Pipeline.objects.filter(
            owner=self.as_owner,
        )
        for pipeline in pipelines:
            pipeline.remove()

    def delete_pipeline(self, pipeline_id: str) -> None:
        """Delete user pipelines."""
        pipelines = Pipeline.objects.filter(
            owner=self.as_owner,
            pk=int(pipeline_id),
        )
        for pipeline in pipelines:
            pipeline.remove()

    def can_create(self) -> bool:
        """Check if a user is not limited by the daily quota."""
        if self.is_superuser:
            return True
        today = timezone.now().replace(
            hour=0, minute=0, second=0, microsecond=0)
        jobs_made = self.job_class.objects.filter(
            created__gte=today, owner__exact=self.pk)
        if len(jobs_made) >= cast(int, settings.QUOTAS["daily_jobs"]):
            return False
        return True


class WebAnnotationAnonymousUser(BaseUser, AnonymousUser):
    """Model for anonymous user accounts."""

    def __init__(self, session_id: str, ip: str = "") -> None:
        super().__init__()
        self.ip = ip
        self._session_id = session_id

    @property
    def job_class(self) -> type[AnonymousJob]:
        """Get job class used."""
        return AnonymousJob

    @property
    def session_id(self) -> str:
        """Get session ID for user."""
        return self._session_id

    @property
    def identifier(self) -> str:
        """Get identifier for anonymous user."""
        return f"anon_{self.session_id}"

    @property
    def as_owner(self) -> str:
        return self.identifier

    def get_socket_group(self) -> str:
        """Get socket group for user."""
        return self.identifier

    def is_owner(self, job: AnonymousJob) -> bool:
        return job.owner == self.identifier

    def generate_job_name(self) -> int:
        return time.time_ns()

    def create_job(self, **kwargs: Any) -> AnonymousJob:
        """Create a new job for the anonymous user."""
        job = self.job_class(
            owner=self.identifier,
            ip=self.ip,
            **kwargs,
        )
        return job

    def get_jobs(self) -> list[AnonymousJob]:
        """Get user's jobs."""
        jobs = self.job_class.objects.filter(
            owner=self.as_owner,
        )
        return list(jobs)

    def delete_jobs(self) -> None:
        """Get user's jobs."""
        jobs = self.job_class.objects.filter(
            owner=self.as_owner,
        )
        for job in jobs:
            job.delete()

    def can_create(self) -> bool:
        """Check if a anonymous user is not limited by the daily quota."""
        today = timezone.now().replace(
            hour=0, minute=0, second=0, microsecond=0)
        jobs_made = self.job_class.objects.filter(
            created__gte=today, ip=self.ip)
        if len(jobs_made) >= cast(int, settings.QUOTAS["daily_jobs"]):
            return False
        return True

    def save(self) -> None:
        """Anonymous user cannot be saved."""
        raise NotImplementedError

    class Meta:  # pylint: disable=too-few-public-methods
        """Meta class for verification model."""
        abstract = True

    def get_pipeline(self, pipeline_id: str) -> BasePipeline:
        raise NotImplementedError(
            "Anonymous users cannot have named pipelines!")

    def get_pipelines(self) -> list[BasePipeline]:
        """Get pipelines for user."""
        return []

    def delete_pipeline(self, pipeline_id: str) -> BasePipeline:
        raise NotImplementedError(
            "Anonymous users cannot have named pipelines!")


class BasePipeline(models.Model):
    """Base Model for saving pipeline configs"""
    name = models.CharField(max_length=1024, default="")
    config_path = models.FilePathField()

    def remove(self) -> None:
        """Clean a user pipeline's resources."""
        os.remove(self.config_path)
        self.delete()

    @property
    def identifier(self) -> str:
        """Get a unique identifier for the pipeline."""
        raise NotImplementedError

    def table_id(self) -> tuple[str, str]:
        """Get a unique table ID for the pipeline."""
        return ("unspecified", str(self.pk))

    class Meta:  # pylint: disable=too-few-public-methods
        """Meta class for verification model."""
        abstract = True


class Pipeline(BasePipeline):
    """Model for saving user created pipeline configs"""
    owner = models.ForeignKey(
        'web_annotation.User',
        related_name='pipelines',
        on_delete=models.CASCADE,

    )

    @property
    def identifier(self) -> str:
        """Get a unique identifier for the pipeline."""
        return str(self.pk)

    def table_id(self) -> tuple[str, str]:
        """Get a unique table ID for the pipeline."""
        return ("user", str(self.pk))


class TemporaryPipeline(BasePipeline):
    """Model for saving anonymous created pipeline configs"""
    session_id = models.CharField(max_length=1024, primary_key=True)

    @property
    def identifier(self) -> str:
        """Get a unique identifier for the pipeline."""
        return str(self.session_id)

    @property
    def id(self) -> str:
        return self.session_id

    def table_id(self) -> tuple[str, str]:
        """Get a unique table ID for the pipeline."""
        return ("anonymous", str(self.pk))


class AlleleQuery(models.Model):
    """Model for saving user created pipeline configs"""
    allele = models.CharField(max_length=1024)
    owner = models.ForeignKey(
        'web_annotation.User',
        related_name='allele_query',
        on_delete=models.CASCADE,
    )

    def remove(self) -> None:
        """Diactivate a job and clean its resources."""
        self.delete()


class BaseJob(models.Model):
    """Base model for storing job data."""
    class Status(models.IntegerChoices):  # pylint: disable=too-many-ancestors
        """Class for job status."""
        WAITING = 1
        IN_PROGRESS = 2
        SUCCESS = 3
        FAILED = 4

    input_path = models.FilePathField()
    config_path = models.FilePathField()
    result_path = models.FilePathField()
    name = models.BigIntegerField(default=0)
    reference_genome = models.CharField(max_length=1024, default="")
    created = models.DateTimeField(default=timezone.now)
    status = models.IntegerField(choices=Status, default=Status.WAITING)
    duration = models.FloatField(null=True, default=None)
    command_line = models.TextField(default="")
    error = models.TextField(default="")
    annotation_type = models.CharField(max_length=1024, default="")
    disk_size = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    def _cleanup_files(self) -> None:
        """Clean up job files."""
        os.remove(self.input_path)
        os.remove(self.config_path)
        if pathlib.Path(self.result_path).exists():
            os.remove(self.result_path)

    def deactivate(self) -> None:
        """Diactivate a job and clean its resources."""
        self.is_active = False
        self._cleanup_files()
        self.disk_size = 0
        self.save()

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        """Delete a job and its resources."""
        self._cleanup_files()
        return super().delete(*args, **kwargs)

    class Meta:  # pylint: disable=too-few-public-methods
        """Meta class for verification model."""
        abstract = True

    def update_job_in_progress(self) -> None:
        """Update a job's state to in progress."""
        if self.status != Job.Status.WAITING:
            raise ValueError(
                f"Attempted to start job {self.pk}, which is not in waiting! "
                f"({self.status})",
            )
        self.status = Job.Status.IN_PROGRESS
        self.save()

    def update_job_failed(self, args: str, exc: str) -> None:
        """Update a job's state to failed."""
        if self.status != Job.Status.IN_PROGRESS:
            raise ValueError(
                f"Attempted to mark job {self.pk} as failed, "
                f"which is not in in progress! ({self.status})",
            )
        self.status = Job.Status.FAILED
        self.command_line = args
        self.error = exc
        self.save()

    def update_job_success(self, args: str) -> None:
        """Update a job's state to success."""
        if self.status != Job.Status.IN_PROGRESS:
            raise ValueError(
                f"Attempted to start job {self.pk}, which is not in waiting! "
                f"({self.status})",
            )
        self.status = Job.Status.SUCCESS
        self.command_line = args
        self.save()


class Job(BaseJob):
    """Model for storing job data."""

    owner = models.ForeignKey(
        'web_annotation.User',
        related_name='jobs',
        on_delete=models.CASCADE,
    )

    def update_job_failed(self, args: str, exc: str) -> None:
        """Update a job's state to failed."""
        super().update_job_failed(args, exc)

        send_email(
            "GPFWA: Annotation job failed",
            (
                "Your job has failed. "
                "Visit the web site to try running it again: "
                f"{settings.EMAIL_REDIRECT_ENDPOINT}/jobs"
            ),
            [self.owner.identifier],
        )

    def update_job_success(self, args: str) -> None:
        """Update a job's state to success."""
        super().update_job_success(args)
        send_email(
            "GPFWA: Annotation job finished successfully",
            (
                "Your job has finished successfully. "
                "Visit the web site to download the results: "
                f"{settings.EMAIL_REDIRECT_ENDPOINT}/jobs"
            ),
            [self.owner.identifier],
        )

    def get_job_details(self) -> JobDetails:
        """Get or initiate job details."""
        try:
            return JobDetails.objects.get(job__pk=self.pk)
        except models.ObjectDoesNotExist:
            details = JobDetails(job=self)
            details.save()
            return details


class AnonymousJob(BaseJob):
    """Model for storing job data."""

    owner = models.CharField(max_length=1024)
    ip = models.CharField(max_length=256, default="")

    def get_job_details(self) -> AnonymousJobDetails:
        """Get or initiate job details."""
        try:
            return AnonymousJobDetails.objects.get(job__pk=self.pk)
        except models.ObjectDoesNotExist:
            details = AnonymousJobDetails(job=self)
            details.save()
            return details


class BaseJobDetails(models.Model):
    """Model for storing job details for tsv files."""
    class Meta:  # pylint: disable=too-few-public-methods
        """Meta class for verification model."""
        abstract = True
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


class JobDetails(BaseJobDetails):
    """Model for storing job details for tsv files."""
    class Meta(BaseJobDetails.Meta):  # pylint: disable=too-few-public-methods
        """Meta class for details model."""
        constraints = [
            models.UniqueConstraint(fields=["job"], name="unique_job_details")
        ]
    job = models.ForeignKey(
        'web_annotation.Job', related_name='details', on_delete=models.CASCADE)


class AnonymousJobDetails(BaseJobDetails):
    """Model for storing job details for tsv files."""
    class Meta(BaseJobDetails.Meta):  # pylint: disable=too-few-public-methods
        """Meta class for details model."""
        constraints = [
            models.UniqueConstraint(
                fields=["job"],
                name="unique_anonymous_job_details",
            )
        ]
    job = models.ForeignKey(
        'web_annotation.AnonymousJob',
        related_name='details',
        on_delete=models.CASCADE)


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
