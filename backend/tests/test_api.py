import datetime
import pathlib
import textwrap
import shutil
from django.core.files.base import ContentFile
from django.contrib.auth.models import User
from django.http.response import FileResponse
import pytest
from django.test import Client
from django.conf import settings

from web_annotation.models import Job


pytestmark = pytest.mark.django_db


@pytest.fixture(scope="session", autouse=True)
def setup_data_dirs():
    assert not pathlib.Path(settings.DATA_STORAGE_DIR).exists()
    pathlib.Path(settings.DATA_STORAGE_DIR).mkdir()
    pathlib.Path(settings.ANNOTATION_CONFIG_STORAGE_DIR).mkdir()
    pathlib.Path(settings.JOB_INPUT_STORAGE_DIR).mkdir()
    pathlib.Path(settings.JOB_RESULT_STORAGE_DIR).mkdir()
    yield
    shutil.rmtree(settings.DATA_STORAGE_DIR)


@pytest.fixture(autouse=True)
def setup_test_db(
    tmp_path: pathlib.Path,
) -> None:
    user = User.objects.create_user(
        "test-user",
        "user@example.com",
        "secret",
    )
    user.save()
    user_input = tmp_path / "user-input.vcf"
    user_input.write_text("mock vcf data")
    user_config = tmp_path / "user-config.yaml"
    user_config.write_text("mock annotation config")
    user_result = tmp_path / "user-result.vcf"
    user_result.write_text("mock annotated vcf")
    Job(
        input_path=user_input,
        config_path=user_config,
        result_path=user_result,
        owner=user,
    ).save()

    admin = User.objects.create_superuser(
        "test-admin",
        "admin@example.com",
        "secret",
    )
    admin.save()
    admin_input = tmp_path / "admin-input.vcf"
    admin_input.write_text("mock vcf data 2")
    admin_config = tmp_path / "admin-config.yaml"
    admin_config.write_text("mock annotation config 2")
    admin_result = tmp_path / "admin-result.vcf"
    admin_result.write_text("mock annotated vcf 2")
    Job(
        input_path=admin_input,
        config_path=admin_config,
        result_path=admin_result,
        owner=admin,
    ).save()


@pytest.fixture
def admin_client() -> Client:
    client = Client()
    client.login(username="test-admin", password="secret")
    return client


@pytest.fixture
def user_client() -> Client:
    client = Client()
    client.login(username="test-user", password="secret")
    return client


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
    assert job["owner"] == "test-user"

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
    assert job["owner"] == "test-admin"


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
    assert job["owner"] == "test-user"

    job = result[1]
    assert "created" in job
    created = datetime.datetime.fromisoformat(job["created"])
    now = datetime.datetime.now(datetime.timezone.utc)
    assert abs(now - created) < datetime.timedelta(minutes=1)
    assert job["id"] == 2
    assert job["status"] == 1
    assert job["owner"] == "test-admin"


def test_create_job(user_client: Client) -> None:
    user = User.objects.get(username="test-user")

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


def test_create_job_bad_config(user_client: Client) -> None:
    user = User.objects.get(username="test-user")

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
    user = User.objects.get(username="test-user")

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
    user = User.objects.get(username="test-user")

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
    assert result["owner"] == "test-user"


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


def test_get_users(admin_client: Client) -> None:
    response = admin_client.get("/users/")
    assert response.status_code == 200
    assert response.json() == [
        {"username": "test-user", "email": "user@example.com", "jobs": [1]},
        {"username": "test-admin", "email": "admin@example.com", "jobs": [2]},
    ]


def test_get_users_unauthorized(user_client: Client) -> None:
    response = user_client.get("/users/")
    assert response.status_code == 403


def test_get_user_details(admin_client: Client) -> None:
    response = admin_client.get("/users/1/")
    assert response.status_code == 200
    assert response.json() == {
        "username": "test-user", "email": "user@example.com", "jobs": [1],
    }


def test_get_user_details_unauthorized(user_client: Client) -> None:
    response = user_client.get("/users/1/")
    assert response.status_code == 403


def test_register(client: Client) -> None:
    response = client.post(
        "/register/",
        {"username": "gosho",
         "email": "gosho@example.com",
         "password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert User.objects.filter(email="gosho@example.com").exists()
    user = User.objects.get(email="gosho@example.com")
    assert user.username == "gosho"


def test_register_username_taken(client: Client) -> None:
    response = client.post(
        "/register/",
        {"username": "test-user",
         "email": "gosho@example.com",
         "password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_register_email_taken(client: Client) -> None:
    response = client.post(
        "/register/",
        {"username": "gosho",
         "email": "user@example.com",
         "password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_register_bad_requests(client: Client) -> None:
    response = client.post(
        "/register/",
        {"email": "gosho@example.com",
         "password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 400

    response = client.post(
        "/register/",
        {"username": "gosho",
         "password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 400

    response = client.post(
        "/register/",
        {"username": "gosho",
         "email": "gosho@example.com"},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_login(client: Client) -> None:
    response = client.post(
        "/login/",
        {"username": "test-user",
         "password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 200

    assert "sessionid" in response.cookies
    assert response.cookies["sessionid"]

    assert "csrftoken" in response.cookies
    assert response.cookies["csrftoken"]


def test_login_user_wrong_password(client: Client) -> None:
    response = client.post(
        "/login/",
        {"username": "test-user",
         "password": "alabala"},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_login_user_does_not_exist(client: Client) -> None:
    response = client.post(
        "/login/",
        {"username": "test-user-two",
         "password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_login_bad_requests(client: Client) -> None:
    response = client.post(
        "/login/",
        {"username": "test-user"},
        content_type="application/json",
    )
    assert response.status_code == 400

    response = client.post(
        "/login/",
        {"password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 400
