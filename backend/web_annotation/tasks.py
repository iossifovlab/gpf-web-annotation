"""Web annotation celery tasks"""
from pathlib import Path
import logging
from celery import shared_task
from .models import Job
from .annotation import annotate_vcf_file
from django.core.mail import send_mail


logger = logging.getLogger(__name__)


def get_job(job_pk: int) -> Job:
    return Job.objects.get(pk=job_pk)


def update_job_in_progress(job: Job) -> None:
    if job.status != Job.Status.WAITING:
        raise ValueError(
            f"Attempted to start job {job.pk}, which is not in waiting! "
            f"({job.status})",
        )
    job.status = Job.Status.IN_PROGRESS
    job.save()


def update_job_failed(job: Job) -> None:
    if job.status != Job.Status.IN_PROGRESS:
        raise ValueError(
            f"Attempted to mark job {job.pk} as failed,"
            f"which is not in in progress! ({job.status})",
        )
    job.status = Job.Status.FAILED
    job.save()

    # pylint: disable=import-outside-toplevel
    from django.conf import settings
    send_email.delay(
        "GPFWA: Annotation job failed",
        (
            "Your job has failed."
            "Visit the web site to try running it again: "
            f"{settings.EMAIL_REDIRECT_ENDPOINT}/jobs"
        ),
        [job.owner.email],
    )


def update_job_success(job: Job) -> None:
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


def run_job(job: Job, storage_dir: Path, grr_definition: Path) -> None:
    try:
        logger.debug("Running job")
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
    except Exception:
        logger.exception("Failed to execute job")
        update_job_failed(job)
    else:
        update_job_success(job)


@shared_task
def create_annotation(
    job_pk: int, storage_dir: Path,
    grr_definition: Path,
) -> None:
    """Task for running annotation."""
    job = get_job(job_pk)
    update_job_in_progress(job)

    run_job(job, storage_dir, grr_definition)


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
