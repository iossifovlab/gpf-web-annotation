# pylint: disable=C0116
import gzip
import pytest
import datetime
import pathlib
import textwrap

from pytest_mock import MockerFixture
from django.core.files.base import ContentFile
from django.conf import LazySettings
from django.test import Client
from django.utils import timezone
from dae.genomic_resources.repository import GenomicResourceRepo

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
    assert job["status"] == Job.Status.WAITING
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
    assert job["status"] == Job.Status.WAITING
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
    assert job["status"] == Job.Status.WAITING
    assert job["owner"] == "user@example.com"

    job = result[1]
    assert "created" in job
    created = datetime.datetime.fromisoformat(job["created"])
    now = datetime.datetime.now(datetime.timezone.utc)
    assert abs(now - created) < datetime.timedelta(minutes=1)
    assert job["id"] == 2
    assert job["status"] == Job.Status.WAITING
    assert job["owner"] == "admin@example.com"


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
    assert result["status"] == Job.Status.WAITING
    assert result["owner"] == "user@example.com"
    assert result["command_line"] == "annotate_vcf mock command line"
    assert result["duration"] == 1.0


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
        "web_annotation.tasks.annotate_vcf_job",
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
        "/api/jobs/annotate_vcf",
        {
            "genome": "hg38",
            "config": ContentFile(annotation_config),
            "data": ContentFile(vcf)
        },
    )
    assert response.status_code == 204

    response = user_client.post(
        "/api/jobs/annotate_vcf",
        {
            "genome": "hg38",
            "config": ContentFile(annotation_config),
            "data": ContentFile(vcf)
        },
    )

    assert response.status_code == 403
    assert response.data["reason"] == "Daily job limit reached!"


@pytest.mark.django_db
def test_daily_admin_quota(
    admin_client: Client,
    mocker: MockerFixture,
) -> None:
    mocked_run_job = mocker.patch(
        "web_annotation.tasks.annotate_vcf_job",
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
        "/api/jobs/annotate_vcf",
        {
            "genome": "hg38",
            "config": ContentFile(annotation_config),
            "data": ContentFile(vcf)
        },
    )
    assert response.status_code == 204

    response = admin_client.post(
        "/api/jobs/annotate_vcf",
        {
            "genome": "hg38",
            "config": ContentFile(annotation_config),
            "data": ContentFile(vcf)
         },
    )

    assert response.status_code == 204


@pytest.mark.django_db
def test_filesize_limit_user(
    user_client: Client,
    mocker: MockerFixture,
    settings: LazySettings,
) -> None:
    settings.LIMITS = {
        "filesize": 1,
        "daily_jobs": settings.LIMITS["daily_jobs"],
        "variant_count": settings.LIMITS["variant_count"],
    }

    mocked_run_job = mocker.patch(
        "web_annotation.tasks.annotate_vcf_job",
    )

    annotation_config = "- position_score: scores/pos1"
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """).strip("\n")

    response = user_client.post(
        "/api/jobs/annotate_vcf",
        {
            "genome": "hg38",
            "config": ContentFile(annotation_config),
            "data": ContentFile(vcf)
        },
    )
    assert response.status_code == 413


@pytest.mark.django_db
def test_filesize_limit_admin(
    admin_client: Client,
    mocker: MockerFixture,
    settings: LazySettings,
) -> None:
    settings.LIMITS = {
        "filesize": 1,
    }

    mocked_run_job = mocker.patch(
        "web_annotation.tasks.annotate_vcf_job",
    )

    annotation_config = "- position_score: scores/pos1"
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """).strip("\n")

    response = admin_client.post(
        "/api/jobs/annotate_vcf",
        {
            "genome": "hg38",
            "config": ContentFile(annotation_config),
            "data": ContentFile(vcf)
        },
    )
    assert response.status_code == 204


@pytest.mark.django_db
def test_variant_limit_user(
    user_client: Client,
    mocker: MockerFixture,
    settings: LazySettings,
) -> None:
    settings.LIMITS = {
        "variant_count": 1,
        "daily_jobs": settings.LIMITS["daily_jobs"],
        "filesize": settings.LIMITS["filesize"],
    }

    mocker.patch(
        "web_annotation.tasks.annotate_vcf_job",
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
        "/api/jobs/annotate_vcf",
        {
            "genome": "hg38",
            "config": ContentFile(annotation_config),
            "data": ContentFile(vcf)
        },
    )
    assert response.status_code == 413


@pytest.mark.django_db
def test_variant_limit_admin(
    admin_client: Client,
    mocker: MockerFixture,
    settings: LazySettings,
) -> None:
    settings.LIMITS = {
        "variant_count": 1,
    }

    mocker.patch(
        "web_annotation.tasks.annotate_vcf_job",
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
        "/api/jobs/annotate_vcf",
        {
            "genome": "hg38",
            "config": ContentFile(annotation_config),
            "data": ContentFile(vcf)
        },
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

    assert response.status_code == 200

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
    assert annotators_data[0]["details"] == {
        "name": "position_score",
        "description": (
            "\n\nAnnotator to use with genomic scores depending on genomic"
            " position like\nphastCons, phyloP, FitCons2, etc.\n"
            "\n<a href=\"https://www.iossifovlab.com/gpfuserdocs/"
            "administration/annotation.html#position-score\" "
            "target=\"_blank\">More info</a>\n\n"
        ),
        "resource_id": "scores/pos1",
        "resource_url": "http://test/scores/pos1/index.html",
    }

    assert len(annotators_data[0]["attributes"]) == 1
    assert annotators_data[0]["attributes"][0]["name"] == "position_1"
    assert annotators_data[0]["attributes"][0]["description"] == \
        "test position score"
    assert annotators_data[0]["attributes"][0]["source"] == "pos1"
    assert annotators_data[0]["attributes"][0]["type"] == "float"
    assert annotators_data[0]["attributes"][0]["result"] == {
        "value": 0.1,
        "histogram": "histograms/scores/pos1?score_id=pos1"
    }
    assert "test position score" in annotators_data[0]["attributes"][0]["help"]
    assert (
        "Annotator to use with genomic "
        "scores depending on genomic position"
    ) in annotators_data[0]["attributes"][0]["help"]


def test_single_annotation_unauthorized(anonymous_client: Client) -> None:
    response = anonymous_client.post(
        "/api/single_annotate",
        {
            "genome": "hg38",
            "variant": {
                "chrom": "chr1", "pos": 1, "ref": "C", "alt": "A",
            }
        },
        content_type="application/json",
    )

    assert response.status_code == 200

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
    assert annotators_data[0]["details"] == {
        "name": "position_score",
        "description": (
            "\n\nAnnotator to use with genomic scores depending on genomic"
            " position like\nphastCons, phyloP, FitCons2, etc.\n"
            "\n<a href=\"https://www.iossifovlab.com/gpfuserdocs/"
            "administration/annotation.html#position-score\" "
            "target=\"_blank\">More info</a>\n\n"
        ),
        "resource_id": "scores/pos1",
        "resource_url": "http://test/scores/pos1/index.html",
    }

    assert len(annotators_data[0]["attributes"]) == 1
    assert annotators_data[0]["attributes"][0]["name"] == "position_1"
    assert annotators_data[0]["attributes"][0]["description"] == \
        "test position score"
    assert annotators_data[0]["attributes"][0]["source"] == "pos1"
    assert annotators_data[0]["attributes"][0]["type"] == "float"
    assert annotators_data[0]["attributes"][0]["result"] == {
        "value": 0.1,
        "histogram": "histograms/scores/pos1?score_id=pos1"
    }
    assert "test position score" in annotators_data[0]["attributes"][0]["help"]
    assert (
        "Annotator to use with genomic "
        "scores depending on genomic position"
    ) in annotators_data[0]["attributes"][0]["help"]


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
        "small_values_desc": "small values",
        "large_values_desc": "large values",
        "bars": [0, 3, 2, 1, 4, 1, 0, 0, 1, 1],
        "out_of_range_bins": [0, 0],
        "min_value": 0.1,
        "max_value": 0.9,
    }


def test_genomes_view(admin_client: Client) -> None:
    response = admin_client.get("/api/genomes")

    assert response.status_code == 200
    assert len(response.data) == 2
    assert response.data[0] == "hg38"
    assert response.data[1] == "t4c8"


def test_single_annotation_throttled(user_client: Client) -> None:
    for _ in range(10):
        response = user_client.post(
            "/api/single_annotate",
            {
                "genome": "hg38",
                "variant": {
                    "chrom": "chr1", "pos": 1, "ref": "C", "alt": "A",
                }
            },
            content_type="application/json",
        )
        assert response.status_code == 200

    response = user_client.post(
        "/api/single_annotate",
        {
            "genome": "hg38",
            "variant": {
                "chrom": "chr1", "pos": 1, "ref": "C", "alt": "A",
            }
        },
        content_type="application/json",
    )
    assert response.status_code == 429


@pytest.mark.django_db
def test_job_deactivate(
    tmp_path: pathlib.Path,
    user_client: Client
) -> None:
    user = User.objects.get(email="user@example.com")

    assert Job.objects.filter(is_active=True, owner=user).count() == 1

    user_input = tmp_path / "user-input1.vcf"
    user_input.write_text("mock vcf data")
    user_config = tmp_path / "user-config1.yaml"
    user_config.write_text("mock annotation config")
    user_result = tmp_path / "user-result1.vcf"
    user_result.write_text("mock annotated vcf")
    Job(
        input_path=user_input,
        config_path=user_config,
        result_path=user_result,
        owner=user,
    ).save()

    assert Job.objects.filter(is_active=True, owner=user).count() == 2

    all_jobs = user_client.get("/api/jobs")
    assert len(all_jobs.json()) == 2

    user_client.delete("/api/jobs/1")

    deactivated_jobs = Job.objects.filter(is_active=False, owner=user)
    assert deactivated_jobs.count() == 1

    assert not pathlib.Path(deactivated_jobs[0].input_path).exists()
    assert not pathlib.Path(deactivated_jobs[0].config_path).exists()
    assert not pathlib.Path(deactivated_jobs[0].result_path).exists()

    all_jobs = user_client.get("/api/jobs")
    assert len(all_jobs.json()) == 1


@pytest.mark.parametrize("separator", [",", "\t"])
def test_preview_delimeter(
    admin_client: Client,
    separator: str,
) -> None:
    file = textwrap.dedent("""
        chrom	pos	ref	alt
        chr1	1	C	A
        chr1	2	C	A
        chr1	3	C	A
        chr1	4	C	A
        chr1	5	C	A
        chr1	6	C	A
        chr1	7	C	A
        chr1	8	C	A
    """).strip().replace("\t", separator)

    response = admin_client.post(
        "/api/jobs/preview",
        {
            "data": ContentFile(file),
        },
    )

    assert response is not None
    assert response.status_code == 200

    result = response.json()

    assert result is not None
    assert result == {
        "separator": separator,
        "preview": [
            {"chrom": "chr1", "pos": "1", "ref": "C", "alt": "A"},
            {"chrom": "chr1", "pos": "2", "ref": "C", "alt": "A"},
            {"chrom": "chr1", "pos": "3", "ref": "C", "alt": "A"},
            {"chrom": "chr1", "pos": "4", "ref": "C", "alt": "A"},
        ],
        "columns": ["chrom", "pos", "ref", "alt"],
    }


def test_preview_delimeter_forced(
    admin_client: Client,
) -> None:
    file = textwrap.dedent("""
        chrom	pos	ref	alt
        chr1	1	C	A
        chr1	2	C	A
    """).strip()

    response = admin_client.post(
        "/api/jobs/preview",
        {
            "data": ContentFile(file),
            "separator": ","
        },
    )

    assert response is not None
    assert response.status_code == 200

    result = response.json()

    assert result is not None
    assert result == {
        "separator": ",",
        "preview": [
            {"chrom	pos	ref	alt": "chr1	1	C	A"},
            {"chrom	pos	ref	alt": "chr1	2	C	A"},
        ],
        "columns": ["chrom	pos	ref	alt"],
    }


@pytest.mark.parametrize("separator", [",", "\t"])
def test_preview_delimiter_gzipped(
    admin_client: Client,
    separator: str,
) -> None:
    file = gzip.compress(textwrap.dedent("""
        chrom	pos	ref	alt
        chr1	1	C	A
        chr1	2	C	A
        chr1	3	C	A
        chr1	4	C	A
        chr1	5	C	A
        chr1	6	C	A
        chr1	7	C	A
        chr1	8	C	A
    """).strip().replace("\t", separator).encode("utf-8"))

    response = admin_client.post(
        "/api/jobs/preview",
        {
            "data": ContentFile(file, "test.tsv.gz"),
        },
    )

    assert response is not None
    assert response.status_code == 200

    result = response.json()

    assert result is not None
    assert result == {
        "separator": separator,
        "preview": [
            {"chrom": "chr1", "pos": "1", "ref": "C", "alt": "A"},
            {"chrom": "chr1", "pos": "2", "ref": "C", "alt": "A"},
            {"chrom": "chr1", "pos": "3", "ref": "C", "alt": "A"},
            {"chrom": "chr1", "pos": "4", "ref": "C", "alt": "A"},
        ],
        "columns": ["chrom", "pos", "ref", "alt"],
    }


def test_preview_delimeter_unsupported(
    admin_client: Client,
) -> None:
    file = textwrap.dedent("""
        chrom;pos;ref;alt
        chr1;1;C;A
    """).strip()

    response = admin_client.post(
        "/api/jobs/preview",
        {
            "data": ContentFile(file),
        },
    )

    assert response is not None
    assert response.status_code == 200

    result = response.json()

    assert result is not None
    assert result == {
        "separator": "",
        "preview": [
            {"chrom;pos;ref;alt": "chr1;1;C;A"},
        ],
        "columns": ["chrom;pos;ref;alt"],
    }


def test_preview_delimeter_anonymous(
    anonymous_client: Client,
) -> None:
    tsv = textwrap.dedent("""
        chrom	pos	ref	alt
        chr1	1	C	A
    """).strip()

    response = anonymous_client.post(
        "/api/jobs/preview",
        {
            "data": ContentFile(tsv),
        },
    )

    assert response is not None
    assert response.status_code == 403


def test_single_annotation_t4c8(admin_client: Client) -> None:
    response = admin_client.post(
        "/api/single_annotate",
        {
            "genome": "t4c8",
            "variant": {
                "chrom": "chr1", "pos": 53, "ref": "C", "alt": "A",
            }
        },
        content_type="application/json",
    )
    assert response.status_code == 200

    data = response.data  # type: ignore
    assert "variant" in data
    assert "annotators" in data

    variant_data = data["variant"]
    annotators_data = data["annotators"]

    assert variant_data == {
        "chromosome": "chr1",
        "position": 53,
        "reference": "C",
        "alternative": "A",
        "variant_type": "SUBSTITUTION",
    }
    assert len(annotators_data) == 2
    effect_annotator = annotators_data[0]
    gene_score_annotator = annotators_data[1]
    assert effect_annotator["details"]["name"] == "effect_annotator"
    assert effect_annotator["details"]["resource_id"] == \
        "t4c8/t4c8_genome, t4c8/t4c8_genes"
    assert effect_annotator["details"]["resource_url"] == \
        "http://test/t4c8/t4c8_genome/index.html"

    assert gene_score_annotator["details"]["name"] == "gene_score_annotator"
    assert gene_score_annotator["details"]["resource_id"] == \
        "t4c8/gene_scores/t4c8_score"
    assert gene_score_annotator["details"]["resource_url"] == \
        "http://test/t4c8/gene_scores/t4c8_score/index.html"

    assert len(gene_score_annotator["attributes"]) == 1
    gene_score_attributes = gene_score_annotator["attributes"]
    assert gene_score_attributes[0]["name"] == "t4c8_score"
    assert gene_score_attributes[0]["source"] == "t4c8_score"
    assert gene_score_attributes[0]["type"] == "object"
    assert gene_score_attributes[0]["result"] == {
        "value": {"t4": 10.123456789},
        "histogram": \
            "histograms/t4c8/gene_scores/t4c8_score?score_id=t4c8_score",
    }

    response = admin_client.post(
        "/api/single_annotate",
        {
            "genome": "t4c8",
            "variant": {
                "chrom": "chr1", "pos": 102, "ref": "C", "alt": "A",
            }
        },
        content_type="application/json",
    )
    assert response.status_code == 200

    data = response.data  # type: ignore
    assert "variant" in data
    assert "annotators" in data

    variant_data = data["variant"]
    annotators_data = data["annotators"]

    assert variant_data == {
        "chromosome": "chr1",
        "position": 102,
        "reference": "C",
        "alternative": "A",
        "variant_type": "SUBSTITUTION",
    }
    assert len(annotators_data) == 2
    effect_annotator = annotators_data[0]
    gene_score_annotator = annotators_data[1]
    assert effect_annotator["details"]["name"] == "effect_annotator"
    assert effect_annotator["details"]["resource_id"] == \
        "t4c8/t4c8_genome, t4c8/t4c8_genes"
    assert effect_annotator["details"]["resource_url"] == \
        "http://test/t4c8/t4c8_genome/index.html"

    assert gene_score_annotator["details"]["name"] == "gene_score_annotator"
    assert gene_score_annotator["details"]["resource_id"] == \
        "t4c8/gene_scores/t4c8_score"
    assert gene_score_annotator["details"]["resource_url"] == \
        "http://test/t4c8/gene_scores/t4c8_score/index.html"

    assert len(gene_score_annotator["attributes"]) == 1
    gene_score_attributes = gene_score_annotator["attributes"]
    assert gene_score_attributes[0]["name"] == "t4c8_score"
    assert gene_score_attributes[0]["source"] == "t4c8_score"
    assert gene_score_attributes[0]["type"] == "object"
    assert gene_score_attributes[0]["result"] == {
        "value": {"c8": 20.0},
        "histogram": \
            "histograms/t4c8/gene_scores/t4c8_score?score_id=t4c8_score",
    }
