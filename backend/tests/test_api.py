import datetime
import pathlib
import textwrap
from django.core.files.base import ContentFile
from django.http.response import FileResponse
from django.test import Client
from django.conf import settings

from web_annotation.models import Job, User


def test_get_jobs(
    user_client: Client,
    admin_client: Client,
) -> None:
    # Each user should have only his jobs listed
    response = user_client.get("/jobs/")
    assert response.status_code == 200

    result = response.json()
    assert len(result) == 1

    job = result[0]
    assert "created" in job
    created = datetime.datetime.fromisoformat(job["created"])
    now = datetime.datetime.now(datetime.timezone.utc)
    assert abs(now - created) < datetime.timedelta(minutes=1)
    assert job["id"] == 1
    assert job["status"] == 1
    assert job["owner"] == "user@example.com"

    # Try with different user, expect different jobs
    response = admin_client.get("/jobs/")
    assert response.status_code == 200

    result = response.json()
    assert len(result) == 1

    job = result[0]
    assert "created" in job
    created = datetime.datetime.fromisoformat(job["created"])
    now = datetime.datetime.now(datetime.timezone.utc)
    assert abs(now - created) < datetime.timedelta(minutes=1)
    assert job["id"] == 2
    assert job["status"] == 1
    assert job["owner"] == "admin@example.com"


def test_get_all_jobs_normal_user(user_client: Client) -> None:
    response = user_client.get("/jobs/all/")
    assert response.status_code == 403


def test_get_all_jobs_admin_user(admin_client: Client) -> None:
    response = admin_client.get("/jobs/all/")
    assert response.status_code == 200

    result = response.json()
    assert len(result) == 2

    job = result[0]
    assert "created" in job
    created = datetime.datetime.fromisoformat(job["created"])
    now = datetime.datetime.now(datetime.timezone.utc)
    assert abs(now - created) < datetime.timedelta(minutes=1)
    assert job["id"] == 1
    assert job["status"] == 1
    assert job["owner"] == "user@example.com"

    job = result[1]
    assert "created" in job
    created = datetime.datetime.fromisoformat(job["created"])
    now = datetime.datetime.now(datetime.timezone.utc)
    assert abs(now - created) < datetime.timedelta(minutes=1)
    assert job["id"] == 2
    assert job["status"] == 1
    assert job["owner"] == "admin@example.com"


def test_create_job(user_client: Client) -> None:
    user = User.objects.get(email="user@example.com")

    assert Job.objects.filter(owner=user).count() == 1

    annotation_config = "sample_annotator: sample_resource"
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """)

    response = user_client.post(
        "/jobs/create/",
        {"config": ContentFile(annotation_config),
         "data": ContentFile(vcf)},
    )
    assert response.status_code == 204

    assert Job.objects.filter(owner=user).count() == 2

    job = Job.objects.get(id=3)

    saved_input = pathlib.Path(job.input_path)
    assert saved_input.exists()
    assert saved_input.read_text() == vcf

    saved_config = pathlib.Path(job.config_path)
    assert saved_config.exists()
    assert saved_config.read_text() == annotation_config

    result_path = pathlib.Path(job.result_path)
    assert str(result_path.parent) == settings.JOB_RESULT_STORAGE_DIR
    assert not result_path.exists()


def test_create_job_calls_annotation_runner(
    user_client: Client,
    mocker,
) -> None:
    mocked_run_job = mocker.patch("web_annotation.views.run_job")

    annotation_config = "sample_annotator: sample_resource"
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """)

    assert mocked_run_job.call_count == 0

    response = user_client.post(
        "/jobs/create/",
        {"config": ContentFile(annotation_config),
         "data": ContentFile(vcf)},
    )
    assert response.status_code == 204

    assert mocked_run_job.call_count == 1



def test_create_job_bad_config(user_client: Client) -> None:
    user = User.objects.get(email="user@example.com")

    assert Job.objects.filter(owner=user).count() == 1

    with open(str(pathlib.Path(__file__).parent / "fixtures" / "GIMP_Pepper.png"), "rb") as image:
        raw_img = image.read()

    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """)

    response = user_client.post(
        "/jobs/create/",
        {"config": ContentFile(raw_img),
         "data": ContentFile(vcf)},
    )
    assert response.status_code == 400


def test_create_job_bad_input_data(user_client: Client) -> None:
    user = User.objects.get(email="user@example.com")

    assert Job.objects.filter(owner=user).count() == 1

    with open(str(pathlib.Path(__file__).parent / "fixtures" / "GIMP_Pepper.png"), "rb") as image:
        raw_img = image.read()

    response = user_client.post(
        "/jobs/create/",
        {"config": ContentFile("sample_annotator: sample_resource"),
         "data": ContentFile(raw_img)},
    )
    assert response.status_code == 400


def test_create_job_non_vcf_input_data(user_client: Client) -> None:
    user = User.objects.get(email="user@example.com")

    assert Job.objects.filter(owner=user).count() == 1

    response = user_client.post(
        "/jobs/create/",
        {"config": ContentFile("sample_annotator: sample_resource"),
         "data": ContentFile("blabla random text")},
    )
    assert response.status_code == 400


def test_job_details(user_client: Client) -> None:
    response = user_client.get("/jobs/1/")
    assert response.status_code == 200

    result = response.json()
    assert "created" in result
    created = datetime.datetime.fromisoformat(result["created"])
    now = datetime.datetime.now(datetime.timezone.utc)
    assert abs(now - created) < datetime.timedelta(minutes=1)
    assert result["id"] == 1
    assert result["status"] == 1
    assert result["owner"] == "user@example.com"


def test_job_details_not_owner(user_client: Client) -> None:
    response = user_client.get("/jobs/2/")
    assert response.status_code == 403


def test_job_file_input(user_client: Client) -> None:
    response: FileResponse = user_client.get("/jobs/1/file/input/")  # type: ignore
    assert response.status_code == 200
    assert response.getvalue() == b"mock vcf data"

    response: FileResponse = user_client.get("/jobs/1/file/config/")  # type: ignore
    assert response.status_code == 200
    assert response.getvalue() == b"mock annotation config"

    response: FileResponse = user_client.get("/jobs/1/file/result/")  # type: ignore
    assert response.status_code == 200
    assert response.getvalue() == b"mock annotated vcf"


def test_job_file_input_bad_request(user_client: Client) -> None:
    response: FileResponse = user_client.get("/jobs/1/file/blabla/")  # type: ignore
    assert response.status_code == 400


def test_job_file_input_not_owner(user_client: Client) -> None:
    response: FileResponse = user_client.get("/jobs/2/file/input/")  # type: ignore
    assert response.status_code == 403


def test_job_file_input_non_existent(user_client: Client) -> None:
    response: FileResponse = user_client.get("/jobs/13/file/input/")  # type: ignore
    assert response.status_code == 404
