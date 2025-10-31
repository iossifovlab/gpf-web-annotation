"""Web annotation celery tasks"""
import logging
import time
from datetime import timedelta
from subprocess import CalledProcessError
from typing import Any

from celery import shared_task
from celery.schedules import crontab
from django.core.exceptions import ObjectDoesNotExist
from django.core.mail import send_mail
from django.utils import timezone
from web_annotation.celery_app import app

from .annotation import annotate_columns_file, annotate_vcf_file
from .models import Job, JobDetails


logger = logging.getLogger(__name__)


def specify_job(  # pylint: disable=too-many-arguments
    job: Job,
    *,
    separator: str | None = None,
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
    details = get_job_details(job.pk)
    if job.status != Job.Status.WAITING:
        raise ValueError("Cannot specify details for jobs in execution!")
    details.separator = separator
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
    try:
        return JobDetails.objects.get(job__pk=job_pk)
    except ObjectDoesNotExist:
        job = get_job(job_pk)
        details = JobDetails(job=job)
        details.save()
        return details


def update_job_in_progress(job: Job) -> None:
    """Update a job's state to in progress."""
    if job.status != Job.Status.WAITING:
        raise ValueError(
            f"Attempted to start job {job.pk}, which is not in waiting! "
            f"({job.status})",
        )
    job.status = Job.Status.IN_PROGRESS
    job.save()


def update_job_failed(job: Job, args: list[str]) -> None:
    """Update a job's state to failed."""
    if job.status != Job.Status.IN_PROGRESS:
        raise ValueError(
            f"Attempted to mark job {job.pk} as failed, "
            f"which is not in in progress! ({job.status})",
        )
    job.status = Job.Status.FAILED
    job.command_line = " ".join(args)
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


def update_job_success(job: Job, args: list[str]) -> None:
    """Update a job's state to success."""
    if job.status != Job.Status.IN_PROGRESS:
        raise ValueError(
            f"Attempted to start job {job.pk}, which is not in waiting! "
            f"({job.status})",
        )
    job.status = Job.Status.SUCCESS
    job.command_line = " ".join(args)
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


def run_vcf_job(
    job: Job, storage_dir: str, grr_definition_path: str | None,
) -> None:
    """Run a VCF annotation."""
    start = time.time()

    logger.debug("Running vcf job")
    logger.debug(job.input_path)
    logger.debug(job.config_path)
    logger.debug(job.result_path)
    logger.debug(storage_dir)

    args = [
        str(job.input_path),
        str(job.config_path),
        "-o", str(job.result_path),
        "-w", storage_dir,
        "-j 1",
        "-vv",
    ]

    if grr_definition_path is not None:
        args.extend(["--grr-filename", grr_definition_path])

    try:
        process = annotate_vcf_file(*args)
    except CalledProcessError:
        logger.exception("Failed to execute job")
        update_job_failed(job, ["annotate_vcf", *args])
    except (OSError, TypeError, ValueError):
        logger.exception("Failed to create job process")
        update_job_failed(job, ["annotate_vcf", *args])

    else:
        job.duration = time.time() - start
        update_job_success(job, process.args)


def delete_old_jobs(days_old: int = 0) -> None:
    """Delete old job resources and make jobs invalid"""
    time_delta = timezone.now() - timedelta(days=days_old)
    old_jobs = Job.objects.filter(
        created__lte=time_delta,
    )

    for job in list(old_jobs):
        job.deactivate()


def run_columns_job(  # pylint: disable=too-many-branches
    job: Job, details: JobDetails,
    storage_dir: str, grr_definition_path: str | None,
) -> None:
    """Run a columnar annotation."""
    start = time.time()

    logger.debug("Running vcf job")
    logger.debug(job.input_path)
    logger.debug(job.config_path)
    logger.debug(job.result_path)
    logger.debug(storage_dir)

    args = [
        str(job.input_path),
        str(job.config_path),
        "--reference-genome-resource-id", str(job.reference_genome),
    ]

    if details.col_chr:
        args.extend(["--col-chrom", details.col_chr])
    if details.col_pos:
        args.extend(["--col-pos", details.col_pos])
    if details.col_ref:
        args.extend(["--col-ref", details.col_ref])
    if details.col_alt:
        args.extend(["--col-alt", details.col_alt])
    if details.col_pos_beg:
        args.extend(["--col-pos-beg", details.col_pos_beg])
    if details.col_pos_end:
        args.extend(["--col-pos-end", details.col_pos_end])
    if details.col_cnv_type:
        args.extend(["--col-cnv-type", details.col_cnv_type])
    if details.col_vcf_like:
        args.extend(["--col-vcf-like", details.col_vcf_like])
    if details.col_variant:
        args.extend(["--col-variant", details.col_variant])
    if details.col_location:
        args.extend(["--col-location", details.col_location])

    if details.separator is not None:
        args.extend([
            "--input-separator", details.separator,
            "--output-separator", details.separator,
        ])

    args.extend([
        "-o", str(job.result_path),
        "-w", storage_dir,
        "-j 1",
        "-vv",
    ])
    if grr_definition_path is not None:
        args.extend(["--grr-filename", grr_definition_path])

    try:
        process = annotate_columns_file(*args)
    except CalledProcessError:
        logger.exception("Failed to execute job")
        update_job_failed(job, ["annotate_columns", *args])
    except (OSError, TypeError, ValueError):
        logger.exception("Failed to create job process")
        update_job_failed(job, ["annotate_columns", *args])

    else:
        job.duration = time.time() - start
        update_job_success(job, process.args)


@shared_task
def annotate_vcf_job(
    job_pk: int, storage_dir: str,
    grr_definition_path: str | None,
) -> None:
    """Task for running annotation."""
    job = get_job(job_pk)
    update_job_in_progress(job)

    run_vcf_job(job, storage_dir, grr_definition_path)


@shared_task
def annotate_columns_job(
    job_pk: int, storage_dir: str,
    grr_definition_path: str,
) -> None:
    """Task for running annotation."""
    job = get_job(job_pk)
    job_details = get_job_details(job_pk)
    update_job_in_progress(job)

    run_columns_job(job, job_details, storage_dir, grr_definition_path)


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
