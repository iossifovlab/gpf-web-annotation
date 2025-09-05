"""Web annotation celery tasks"""
import logging
from celery import shared_task
from django.conf import settings
from .models import Job
from .annotation import run_job


logger = logging.getLogger(__name__)

@shared_task
def create_annotation(job_pk: int):
    """Task for running annotation."""
    job = Job.objects.get(pk=job_pk)
    job.status = Job.Status.IN_PROGRESS
    job.save()
    try:
        logger.debug("Running job")
        logger.debug(job.input_path)
        logger.debug(job.config_path)
        logger.debug(job.result_path)
        logger.debug(settings.JOB_RESULT_STORAGE_DIR)
        run_job(
            str(job.input_path),
            str(job.config_path),
            str(job.result_path),
            settings.JOB_RESULT_STORAGE_DIR,
        )
    except Exception:
        job.status = Job.Status.FAILED
    else:
        job.status = Job.Status.SUCCESS

    job.save()
