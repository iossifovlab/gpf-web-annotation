import pytest

from web_annotation.models import Job
from web_annotation.tasks import \
    update_job_in_progress, update_job_failed, update_job_success


@pytest.mark.django_db
def test_job_update_new() -> None:
    test_job = Job(
        owner_id=1,
        input_path="input", config_path="config", result_path="result",
    )

    assert test_job.status == Job.Status.WAITING
    with pytest.raises(ValueError):
        update_job_failed(test_job)
    with pytest.raises(ValueError):
        update_job_success(test_job)

    assert test_job.status == Job.Status.WAITING
    update_job_in_progress(test_job)
    assert test_job.status == Job.Status.IN_PROGRESS


@pytest.mark.django_db
def test_job_update_in_progress() -> None:
    test_job = Job(
        owner_id=1,
        input_path="input", config_path="config", result_path="result",
        status=Job.Status.IN_PROGRESS,
    )

    with pytest.raises(ValueError):
        update_job_in_progress(test_job)

    assert test_job.status == Job.Status.IN_PROGRESS

    update_job_success(test_job)
    assert test_job.status == Job.Status.SUCCESS

    test_job.status = Job.Status.IN_PROGRESS

    update_job_failed(test_job)
    assert test_job.status == Job.Status.FAILED


@pytest.mark.django_db
def test_job_update_failed() -> None:
    test_job = Job(
        owner_id=1,
        input_path="input", config_path="config", result_path="result",
        status=Job.Status.FAILED,
    )
    with pytest.raises(ValueError):
        update_job_in_progress(test_job)
    with pytest.raises(ValueError):
        update_job_failed(test_job)
    with pytest.raises(ValueError):
        update_job_success(test_job)

    assert test_job.status == Job.Status.FAILED


@pytest.mark.django_db
def test_job_update_success() -> None:
    test_job = Job(
        owner_id=1,
        input_path="input", config_path="config", result_path="result",
        status=Job.Status.SUCCESS,
    )
    with pytest.raises(ValueError):
        update_job_in_progress(test_job)
    with pytest.raises(ValueError):
        update_job_failed(test_job)
    with pytest.raises(ValueError):
        update_job_success(test_job)

    assert test_job.status == Job.Status.SUCCESS
