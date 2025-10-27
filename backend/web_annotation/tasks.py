"""Web annotation celery tasks"""
import logging
from pathlib import Path
from typing import Any
from celery import shared_task
from celery.schedules import crontab
from web_annotation.celery_app import app
from .models import Job, JobDetails
from .annotation import annotate_columns_file, annotate_vcf_file
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)


def specify_job(
    job_pk: int,
    *,
    col_chrom: str = "",
    col_pos: str = "",
    col_ref: str = "",
    col_alt: str = "",
    col_pos_beg: str = "",
    col_pos_end: str = "",
    col_cnv_type: str = "",
    col_vcf_like: str = "",
    col_variant: str = "",
    col_location: str = "",
) -> Job:
    """Specify and update a job's annotation columns."""
    job = get_job(job_pk)
    details = get_job_details(job_pk)
    if job.status != Job.Status.SPECIFYING:
        raise ValueError("Cannot specify a job that is not for specification!")
    details.col_chr = col_chrom
    details.col_pos = col_pos
    details.col_ref = col_ref
    details.col_alt = col_alt
    details.col_pos_beg = col_pos_beg
    details.col_pos_end = col_pos_end
    details.col_cnv_type = col_cnv_type
    details.col_vcf_like = col_vcf_like
    details.col_variant = col_variant
    details.col_location = col_location
    job.status = Job.Status.WAITING
    job.save()
    details.save()

    return job


def get_job(job_pk: int) -> Job:
    """Return a job by primary key."""
    return Job.objects.get(pk=job_pk)


def get_job_details(job_pk: int) -> JobDetails:
    """Return a job's details by job primary key."""
    return JobDetails.objects.get(job__pk=job_pk)


def update_job_in_progress(job: Job) -> None:
    """Update a job's state to in progress."""
    if job.status != Job.Status.WAITING:
        raise ValueError(
            f"Attempted to start job {job.pk}, which is not in waiting! "
            f"({job.status})",
        )
    job.status = Job.Status.IN_PROGRESS
    job.save()


def update_job_failed(job: Job) -> None:
    """Update a job's state to failed."""
    if job.status != Job.Status.IN_PROGRESS:
        raise ValueError(
            f"Attempted to mark job {job.pk} as failed, "
            f"which is not in in progress! ({job.status})",
        )
    job.status = Job.Status.FAILED
    job.save()

    # pylint: disable=import-outside-toplevel
    from django.conf import settings
    send_email.delay(
        "GPFWA: Annotation job failed",
        (
            "Your job has failed. "
            "Visit the web site to try running it again: "
            f"{settings.EMAIL_REDIRECT_ENDPOINT}/jobs"
        ),
        [job.owner.email],
    )


def update_job_success(job: Job) -> None:
    """Update a job's state to success."""
    if job.status != Job.Status.IN_PROGRESS:
        raise ValueError(
            f"Attempted to start job {job.pk}, which is not in waiting! "
            f"({job.status})",
        )
    job.status = Job.Status.SUCCESS
    job.save()

    # pylint: disable=import-outside-toplevel
    from django.conf import settings
    send_email.delay(
        "GPFWA: Annotation job finished successfully",
        (
            "Your job has finished successfully. "
            "Visit the web site to download the results: "
            f"{settings.EMAIL_REDIRECT_ENDPOINT}/jobs"
        ),
        [job.owner.email],
    )


def run_vcf_job(job: Job, storage_dir: Path, grr_definition: Path) -> None:
    """Run a VCF annotation."""
    try:
        logger.debug("Running vcf job")
        logger.debug(job.input_path)
        logger.debug(job.config_path)
        logger.debug(job.result_path)
        logger.debug(storage_dir)
        annotate_vcf_file(
            str(job.input_path),
            str(job.config_path),
            str(job.result_path),
            str(storage_dir),
            str(grr_definition) if grr_definition is not None else None,
        )
    except Exception:  # pylint: disable=broad-exception-caught
        logger.exception("Failed to execute job")
        update_job_failed(job)
    else:
        update_job_success(job)


def delete_old_jobs(days_old: int = 0) -> None:
    """Delete old job resources and make jobs invalid"""
    time_delta = timezone.now() - timedelta(days=days_old)
    old_jobs = Job.objects.filter(
        created__lte=time_delta,
    )

    for job in list(old_jobs):
        job.deactivate()


def run_columns_job(
    job: Job, details: JobDetails,
    storage_dir: str, grr_definition: str | None,
) -> None:
    """Run a columnar annotation."""
    try:
        logger.debug("Running vcf job")
        logger.debug(job.input_path)
        logger.debug(job.config_path)
        logger.debug(job.result_path)
        logger.debug(storage_dir)
        annotate_columns_file(
            str(job.reference_genome),
            str(job.input_path),
            str(job.config_path),
            str(job.result_path),
            storage_dir,
            grr_definition if grr_definition is not None else None,
            separator=details.separator,
            col_chrom=details.col_chr,
            col_pos=details.col_pos,
            col_ref=details.col_ref,
            col_alt=details.col_alt,
            col_pos_beg=details.col_pos_beg,
            col_pos_end=details.col_pos_end,
            col_cnv_type=details.col_cnv_type,
            col_vcf_like=details.col_vcf_like,
            col_variant=details.col_variant,
            col_location=details.col_location,
        )
    except Exception:  # pylint: disable=broad-exception-caught
        logger.exception("Failed to execute job")
        update_job_failed(job)
    else:
        update_job_success(job)


@shared_task
def annotate_vcf_job(
    job_pk: int, storage_dir: Path,
    grr_definition: Path,
) -> None:
    """Task for running annotation."""
    job = get_job(job_pk)
    update_job_in_progress(job)

    run_vcf_job(job, storage_dir, grr_definition)


@shared_task
def annotate_columns_job(
    job_pk: int, storage_dir: str,
    grr_definition: str,
) -> None:
    """Task for running annotation."""
    job = get_job(job_pk)
    job_details = get_job_details(job_pk)
    update_job_in_progress(job)

    run_columns_job(job, job_details, storage_dir, grr_definition)


@shared_task
def send_email(
    subject: str,
    message: str,
    recipient_list: list,
    from_email: str | None = None,
    fail_silently: bool = False,
) -> int:
    """Celery task to send emails asynchronously."""
    # pylint: disable=import-outside-toplevel
    from django.conf import settings

    if from_email is None:
        from_email = settings.DEFAULT_FROM_EMAIL
    mail = send_mail(
        subject,
        message,
        from_email,
        recipient_list,
        fail_silently=fail_silently,
    )

    logger.info("email sent: to:      <%s>", str(recipient_list))
    logger.info("email sent: from:    <%s>", str(from_email))
    logger.info("email sent: subject:  %s", str(subject))
    logger.info("email sent: message:  %s", str(message))

    return mail


@shared_task
def clean_old_jobs() -> None:
    """Task for running annotation."""
    # pylint: disable=import-outside-toplevel
    from django.conf import settings
    delete_old_jobs(settings.JOB_CLEANUP_INTERVAL_DAYS)


@app.on_after_configure.connect
def setup_periodic_tasks(sender: Any, **kwargs: Any) -> None:
    sender.add_periodic_task(
        crontab(hour=0, minute=0, day_of_month=1),
        clean_old_jobs.s(),
        name='delete old jobs every month',
    )
