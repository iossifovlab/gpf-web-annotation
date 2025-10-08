"""Web annotation celery tasks"""
from pathlib import Path
import logging
from celery import shared_task
from .models import Job
from .annotation import annotate_vcf_file


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


def update_job_success(job: Job) -> None:
    if job.status != Job.Status.IN_PROGRESS:
        raise ValueError(
            f"Attempted to start job {job.pk}, which is not in waiting! "
            f"({job.status})",
        )
    job.status = Job.Status.SUCCESS
    job.save()


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
