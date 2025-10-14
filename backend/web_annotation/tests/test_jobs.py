import pytest

from web_annotation.tests.mailhog_client import (
    MailhogClient,
)
from web_annotation.models import Job
from web_annotation.tasks import \
    send_email, update_job_in_progress, update_job_failed, update_job_success
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
