# pylint: disable=W0621,C0114,C0116,W0212,W0613
import pytest
import pathlib

from web_annotation.tests.mailhog_client import (
    MailhogClient,
)
from web_annotation.models import Job, User
from web_annotation.tasks import (
    clean_old_jobs, send_email,
    update_job_in_progress,
    update_job_failed,
    update_job_success,
)
from django.utils import timezone
from datetime import timedelta
from pytest_mock import MockerFixture


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


@pytest.mark.django_db
def test_send_email(mail_client: MailhogClient) -> None:
    email_result = send_email(
        "TEST SUBJECT",
        "TEST MESSAGE",
        ["recipient1@mail.com", "recipient2@mail.com"],
        "sender@mail.com"
    )

    assert email_result == 1


@pytest.mark.django_db
def test_job_failure_starts_email_task(
    mocker: MockerFixture,
) -> None:
    mocked = mocker.patch(
        "web_annotation.tasks.send_email.delay")

    assert mocked.call_count == 0

    test_job = Job(
        owner_id=1,
        input_path="input", config_path="config", result_path="result",
        status=Job.Status.IN_PROGRESS,
    )

    update_job_failed(test_job)

    subject, message, recipient = mocked.call_args_list[0].args
    assert "GPFWA" in subject
    assert "try running it again: http://testserver//jobs" in message
    assert ['user@example.com'] == recipient


@pytest.mark.django_db
def test_job_success_starts_email_task(
    mocker: MockerFixture,
) -> None:
    mocked = mocker.patch(
        "web_annotation.tasks.send_email.delay")

    assert mocked.call_count == 0

    test_job = Job(
        owner_id=1,
        input_path="input", config_path="config", result_path="result",
        status=Job.Status.IN_PROGRESS,
    )

    update_job_success(test_job)

    subject, message, recipient = mocked.call_args_list[0].args
    assert "GPFWA" in subject
    assert "results: http://testserver//jobs" in message
    assert ['user@example.com'] == recipient


@pytest.mark.django_db
def test_clean_old_jobs_removes_old_jobs(
    tmp_path: pathlib.Path,
) -> None:
    user = User.objects.get(email="user@example.com")

    # Create two jobs with old creation date
    for i in [1, 2]:
        user_input = tmp_path / f"user-input{i}.vcf"
        user_input.write_text("mock vcf data")
        user_config = tmp_path / f"user-config{i}.yaml"
        user_config.write_text("mock annotation config")
        user_result = tmp_path / f"user-result{i}.vcf"
        user_result.write_text("mock annotated vcf")
        job = Job(
            input_path=user_input,
            config_path=user_config,
            result_path=user_result,
            owner=user,
            created=timezone.now() - timedelta(days=10),
        )
        job.created = timezone.now() - timedelta(days=10)
        job.save()

    assert Job.objects.filter(is_active=True, owner=user).count() == 3

    clean_old_jobs()

    # Old jobs should be inactive and files deleted
    old_jobs = Job.objects.filter(is_active=False, owner=user)
    assert old_jobs.count() == 2

    assert not pathlib.Path(old_jobs[0].input_path).exists()
    assert not pathlib.Path(old_jobs[0].config_path).exists()
    assert not pathlib.Path(old_jobs[0].result_path).exists()
    assert not pathlib.Path(old_jobs[1].input_path).exists()
    assert not pathlib.Path(old_jobs[1].config_path).exists()
    assert not pathlib.Path(old_jobs[1].result_path).exists()

    recent_job = Job.objects.filter(is_active=True, owner=user).get()
    assert pathlib.Path(recent_job.input_path).exists()
    assert pathlib.Path(recent_job.config_path).exists()
    assert pathlib.Path(recent_job.result_path).exists()
