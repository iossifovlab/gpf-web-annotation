# pylint: disable=C0116
import pytest
import datetime
import pathlib
import textwrap

from pytest_mock import MockerFixture
from django.core.files.base import ContentFile
from django.conf import LazySettings
from dae.genomic_resources.repository import GenomicResourceRepo
from django.test import Client
from django.conf import settings
from django.utils import timezone

from web_annotation.models import Job, User


def test_get_jobs(
    user_client: Client,
    admin_client: Client,
) -> None:
    # Each user should have only his jobs listed
    response = user_client.get("/api/jobs")
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
    response = admin_client.get("/api/jobs")
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
    response = user_client.get("/api/jobs/all")
    assert response.status_code == 403


def test_get_all_jobs_admin_user(admin_client: Client) -> None:
    response = admin_client.get("/api/jobs/all")
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


@pytest.mark.django_db
def test_create_job(
    user_client: Client, test_grr: GenomicResourceRepo,
) -> None:
    user = User.objects.get(email="user@example.com")

    assert Job.objects.filter(owner=user).count() == 1

    annotation_config = "- position_score: scores/pos1"
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """).strip()

    response = user_client.post(
        "/api/jobs/create",
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
    assert result_path.exists()


@pytest.mark.django_db
def test_create_job_calls_annotation_runner(
    user_client: Client,
    mocker: MockerFixture,
) -> None:
    mocked = mocker.patch(
        "web_annotation.tasks.create_annotation.delay")

    annotation_config = "- position_score: scores/pos1"
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """).strip("\n")

    assert mocked.call_count == 0

    assert len(Job.objects.all()) == 2

    response = user_client.post(
        "/api/jobs/create",
        {"config": ContentFile(annotation_config),
         "data": ContentFile(vcf)},
    )
    assert response.status_code == 204

    assert mocked.call_count == 1

    assert len(Job.objects.all()) == 3
    created_job = Job.objects.all().latest("pk")
    assert created_job.owner.email == "user@example.com"


@pytest.mark.django_db
def test_create_job_bad_config(user_client: Client) -> None:
    user = User.objects.get(email="user@example.com")

    assert Job.objects.filter(owner=user).count() == 1

    with open(
        str(pathlib.Path(__file__).parent / "fixtures" / "GIMP_Pepper.png"),
        "rb",
    ) as image:
        raw_img = image.read()

    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """)

    assert len(Job.objects.all()) == 2
    response = user_client.post(
        "/api/jobs/create",
        {"config": ContentFile(raw_img),
         "data": ContentFile(vcf)},
    )
    assert len(Job.objects.all()) == 2
    assert response.status_code == 400


@pytest.mark.django_db
def test_create_job_bad_input_data(user_client: Client) -> None:
    user = User.objects.get(email="user@example.com")

    assert Job.objects.filter(owner=user).count() == 1

    with open(str(
            pathlib.Path(__file__).parent /
            "fixtures" / "GIMP_Pepper.png"), "rb") as image:
        raw_img = image.read()

    assert len(Job.objects.all()) == 2
    response = user_client.post(
        "/api/jobs/create",
        {"config": ContentFile("- sample_annotator: sample_resource"),
         "data": ContentFile(raw_img)},
    )
    assert len(Job.objects.all()) == 2
    assert response.status_code == 400


@pytest.mark.django_db
def test_create_job_non_vcf_input_data(user_client: Client) -> None:
    user = User.objects.get(email="user@example.com")

    assert Job.objects.filter(owner=user).count() == 1

    assert len(Job.objects.all()) == 2
    response = user_client.post(
        "/api/jobs/create",
        {"config": ContentFile("sample_annotator: sample_resource"),
         "data": ContentFile("blabla random text")},
    )
    assert len(Job.objects.all()) == 2
    assert response.status_code == 400


@pytest.mark.django_db
def test_job_details(user_client: Client) -> None:
    response = user_client.get("/api/jobs/1")
    assert response.status_code == 200

    result = response.json()
    assert "created" in result
    created = datetime.datetime.fromisoformat(result["created"])
    now = datetime.datetime.now(datetime.timezone.utc)
    assert abs(now - created) < datetime.timedelta(minutes=1)
    assert result["id"] == 1
    assert result["status"] == 1
    assert result["owner"] == "user@example.com"


@pytest.mark.django_db
def test_job_details_not_owner(user_client: Client) -> None:
    response = user_client.get("/api/jobs/2")
    assert response.status_code == 403


@pytest.mark.django_db
def test_job_file_input(user_client: Client) -> None:
    response = user_client.get("/api/jobs/1/file/input")
    assert response.status_code == 200
    assert response.getvalue() == b"mock vcf data"

    response = user_client.get("/api/jobs/1/file/config")
    assert response.status_code == 200
    assert response.getvalue() == b"mock annotation config"

    response = user_client.get("/api/jobs/1/file/result")
    assert response.status_code == 200
    assert response.getvalue() == b"mock annotated vcf"


@pytest.mark.django_db
def test_job_file_input_bad_request(user_client: Client) -> None:
    response = user_client.get("/api/jobs/1/file/blabla")
    assert response.status_code == 400


@pytest.mark.django_db
def test_job_file_input_not_owner(user_client: Client) -> None:
    response = user_client.get("/api/jobs/2/file/input")
    assert response.status_code == 403


@pytest.mark.django_db
def test_job_file_input_non_existent(user_client: Client) -> None:
    response = user_client.get("/api/jobs/13/file/input")
    assert response.status_code == 404

@pytest.mark.django_db
def test_daily_user_quota(
    user_client: Client,
    mocker: MockerFixture,
) -> None:
    mocked_run_job = mocker.patch(
        "web_annotation.tasks.create_annotation.delay",
    )

    annotation_config = "- position_score: scores/pos1"
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """).strip("\n")

    job_created_at = timezone.now() - timezone.timedelta(seconds=1)
    user = User.objects.get(email="user@example.com")
    for i in range(4):
        Job(
            input_path="test",
            config_path="test",
            result_path="test",
            created=job_created_at,
            owner=user,
        ).save()
    response = user_client.post(
        "/api/jobs/create",
        {"config": ContentFile(annotation_config),
         "data": ContentFile(vcf)},
    )
    assert response.status_code == 204

    response = user_client.post(
        "/api/jobs/create",
        {"config": ContentFile(annotation_config),
         "data": ContentFile(vcf)},
    )

    assert response.status_code == 403
    assert response.data["reason"] == "Daily job limit reached!"


@pytest.mark.django_db
def test_daily_admin_quota(
    admin_client: Client,
    mocker: MockerFixture,
) -> None:
    mocked_run_job = mocker.patch(
        "web_annotation.tasks.create_annotation.delay",
    )

    annotation_config = "- position_score: scores/pos1"
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """).strip("\n")

    job_created_at = timezone.now() - timezone.timedelta(seconds=1)
    admin = User.objects.get(email="user@example.com")
    for i in range(4):
        Job(
            input_path="test",
            config_path="test",
            result_path="test",
            created=job_created_at,
            owner=admin,
        ).save()
    response = admin_client.post(
        "/api/jobs/create",
        {"config": ContentFile(annotation_config),
         "data": ContentFile(vcf)},
    )
    assert response.status_code == 204

    response = admin_client.post(
        "/api/jobs/create",
        {"config": ContentFile(annotation_config),
         "data": ContentFile(vcf)},
    )

    assert response.status_code == 204


@pytest.mark.django_db
def test_filesize_limit_user(
    user_client: Client,
    mocker: MockerFixture,
    settings: LazySettings,
) -> None:
    settings.LIMITS["filesize"] = 1

    mocked_run_job = mocker.patch(
        "web_annotation.tasks.create_annotation.delay",
    )

    annotation_config = "- position_score: scores/pos1"
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """).strip("\n")

    response = user_client.post(
        "/api/jobs/create",
        {"config": ContentFile(annotation_config),
         "data": ContentFile(vcf)},
    )
    assert response.status_code == 413


@pytest.mark.django_db
def test_filesize_limit_admin(
    admin_client: Client,
    mocker: MockerFixture,
    settings: LazySettings,
) -> None:
    settings.LIMITS["filesize"] = 1

    mocked_run_job = mocker.patch(
        "web_annotation.tasks.create_annotation.delay",
    )

    annotation_config = "- position_score: scores/pos1"
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """).strip("\n")

    response = admin_client.post(
        "/api/jobs/create",
        {"config": ContentFile(annotation_config),
         "data": ContentFile(vcf)},
    )
    assert response.status_code == 204


@pytest.mark.django_db
def test_variant_limit_user(
    user_client: Client,
    mocker: MockerFixture,
    settings: LazySettings,
) -> None:
    settings.LIMITS["variant_count"] = 1

    mocked_run_job = mocker.patch(
        "web_annotation.tasks.create_annotation.delay",
    )

    annotation_config = "- position_score: scores/pos1"
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
        chr1	2	.	C	A	.	.	.
    """).strip("\n")

    response = user_client.post(
        "/api/jobs/create",
        {"config": ContentFile(annotation_config),
         "data": ContentFile(vcf)},
    )
    assert response.status_code == 413


@pytest.mark.django_db
def test_variant_limit_admin(
    admin_client: Client,
    mocker: MockerFixture,
    settings: LazySettings,
) -> None:
    settings.LIMITS["variant_count"] = 1

    mocked_run_job = mocker.patch(
        "web_annotation.tasks.create_annotation.delay",
    )

    annotation_config = "- position_score: scores/pos1"
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
        chr1	2	.	C	A	.	.	.
    """).strip("\n")

    response = admin_client.post(
        "/api/jobs/create",
        {"config": ContentFile(annotation_config),
         "data": ContentFile(vcf)},
    )
    assert response.status_code == 204


@pytest.mark.django_db
def test_validate_annotation_config(
    user_client: Client, test_grr: GenomicResourceRepo,
) -> None:
    annotation_config = "- position_score: scores/pos1"

    response = user_client.post(
        "/api/jobs/validate",
        {"config": annotation_config},
    )
    assert response.status_code == 200
    assert response.json() == {"errors": ""}

    annotation_config = "position_score: scores/pos1"

    response = user_client.post(
        "/api/jobs/validate",
        {"config": annotation_config},
    )
    assert response.status_code == 200
    assert response.json() == {
        "errors": "Invalid configuration, reason: 'annotators'",
    }


def test_single_annotation(admin_client: Client) -> None:
    response = admin_client.post(
        "/api/single_annotate",
        {
            "genome": "hg38",
            "variant": {
                "chrom": "chr1", "pos": 1, "ref": "C", "alt": "A",
            }
        },
        content_type="application/json",
    )

    data = response.data
    assert "variant" in data
    assert "annotators" in data

    variant_data = data["variant"]
    annotators_data = data["annotators"]

    assert variant_data == {
        "chromosome": "chr1",
        "position": 1,
        "reference": "C",
        "alternative": "A",
        "variant_type": "SUBSTITUTION",
    }
    assert len(annotators_data) == 1
    assert annotators_data[0] == {
        "details": {
            "name": "position_score",
            "description": (
                "\n\nAnnotator to use with genomic scores depending on genomic"
                " position like\nphastCons, phyloP, FitCons2, etc.\n"
                "\n<a href=\"https://www.iossifovlab.com/gpfuserdocs/"
                "administration/annotation.html#position-score\" "
                "target=\"_blank\">More info</a>\n\n"
            ),
            "resource_id": "scores/pos1",
        },
        "attributes": [
            {
                "name": "position_1",
                "description": "test position score",
                "source": "pos1",
                "result": {
                    "value": 0.1,
                    "histogram": "histograms/scores/pos1?score_id=pos1"
                }
            }
        ]
    }


def test_histogram_view(admin_client: Client) -> None:
    response = admin_client.get("/api/histograms/scores/pos1?score_id=pos1")

    assert response.status_code == 200
    data = response.data
    assert data == {
        "config": {
            "type": "number",
            "view_range": {"min": 0.0, "max": 1.0},
            "number_of_bins": 10,
            "x_log_scale": False,
            "y_log_scale": False,
            "x_min_log": None
        },
        "bins": [
            pytest.approx(0.0),
            pytest.approx(0.1),
            pytest.approx(0.2),
            pytest.approx(0.3),
            pytest.approx(0.4),
            pytest.approx(0.5),
            pytest.approx(0.6),
            pytest.approx(0.7),
            pytest.approx(0.8),
            pytest.approx(0.9),
            pytest.approx(1.0),
        ],
        "bars": [0, 3, 2, 1, 4, 1, 0, 0, 1, 1],
        "out_of_range_bins": [0, 0],
        "min_value": 0.1,
        "max_value": 0.9,
    }


def test_genomes_view(admin_client: Client) -> None:
    response = admin_client.get("/api/genomes")

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0] == "hg38"
