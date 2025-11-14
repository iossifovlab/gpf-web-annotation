# pylint: disable=W0621,C0114,C0116,W0212,W0613
import datetime
import gzip
import pathlib
import textwrap
from typing import Any
from pysam import tabix_compress

import pytest
import pytest_mock
from dae.genomic_resources.repository import GenomicResourceRepo
from django.conf import settings
from django.core.files.base import ContentFile
from django.test import Client
from django.utils import timezone
from pytest_mock import MockerFixture

from web_annotation.executor import SequentialTaskExecutor
from web_annotation.models import Job, User, Pipeline
from web_annotation.tasks import (
    clean_old_jobs, send_email,
    update_job_in_progress,
    update_job_failed,
    update_job_success,
)
from web_annotation.tests.mailhog_client import (
    MailhogClient,
)


@pytest.fixture(autouse=True)
def sequential_task_executor(
    mocker: pytest_mock.MockerFixture,
) -> None:
    mocker.patch(
        "web_annotation.views.AnnotationBaseView.TASK_EXECUTOR",
        new_callable=SequentialTaskExecutor,
    )


@pytest.mark.django_db(transaction=True)
def test_job_update_new() -> None:
    test_job = Job(
        owner_id=1,
        input_path="input", config_path="config", result_path="result",
    )

    assert test_job.status == Job.Status.WAITING
    with pytest.raises(ValueError):
        update_job_failed(test_job,  [])
    with pytest.raises(ValueError):
        update_job_success(test_job, [])

    assert test_job.status == Job.Status.WAITING
    update_job_in_progress(test_job)
    assert test_job.status == Job.Status.IN_PROGRESS


@pytest.mark.django_db(transaction=True)
def test_job_update_in_progress() -> None:
    test_job = Job(
        owner_id=1,
        input_path="input", config_path="config", result_path="result",
        status=Job.Status.IN_PROGRESS,
    )

    with pytest.raises(ValueError):
        update_job_in_progress(test_job)

    assert test_job.status == Job.Status.IN_PROGRESS

    update_job_success(test_job, [])
    assert test_job.status == Job.Status.SUCCESS

    test_job.status = Job.Status.IN_PROGRESS

    update_job_failed(test_job, [])
    assert test_job.status == Job.Status.FAILED


@pytest.mark.django_db(transaction=True)
def test_job_update_failed() -> None:
    test_job = Job(
        owner_id=1,
        input_path="input", config_path="config", result_path="result",
        status=Job.Status.FAILED,
    )
    with pytest.raises(ValueError):
        update_job_in_progress(test_job)
    with pytest.raises(ValueError):
        update_job_failed(test_job, [])
    with pytest.raises(ValueError):
        update_job_success(test_job, [])

    assert test_job.status == Job.Status.FAILED


@pytest.mark.django_db(transaction=True)
def test_job_update_success() -> None:
    test_job = Job(
        owner_id=1,
        input_path="input", config_path="config", result_path="result",
        status=Job.Status.SUCCESS,
    )
    with pytest.raises(ValueError):
        update_job_in_progress(test_job)
    with pytest.raises(ValueError):
        update_job_failed(test_job, [])
    with pytest.raises(ValueError):
        update_job_success(test_job, [])

    assert test_job.status == Job.Status.SUCCESS


@pytest.mark.django_db(transaction=True)
def test_send_email(mail_client: MailhogClient) -> None:
    email_result = send_email(
        "TEST SUBJECT",
        "TEST MESSAGE",
        ["recipient1@mail.com", "recipient2@mail.com"],
        "sender@mail.com"
    )

    assert email_result == 1


@pytest.mark.django_db(transaction=True)
def test_job_failure_starts_email_task(
    mocker: MockerFixture,
) -> None:
    mocked = mocker.patch(
        "web_annotation.tasks.send_email")

    assert mocked.call_count == 0

    test_job = Job(
        owner_id=1,
        input_path="input", config_path="config", result_path="result",
        status=Job.Status.IN_PROGRESS,
    )

    update_job_failed(test_job, [])

    subject, message, recipient = mocked.call_args_list[0].args
    assert "GPFWA" in subject
    assert "try running it again: http://testserver//jobs" in message
    assert ['user@example.com'] == recipient


@pytest.mark.django_db(transaction=True)
def test_job_success_starts_email_task(
    mocker: MockerFixture,
) -> None:
    mocked = mocker.patch(
        "web_annotation.tasks.send_email")

    assert mocked.call_count == 0

    test_job = Job(
        owner_id=1,
        input_path="input", config_path="config", result_path="result",
        status=Job.Status.IN_PROGRESS,
    )

    update_job_success(test_job, [])

    subject, message, recipient = mocked.call_args_list[0].args
    assert "GPFWA" in subject
    assert "results: http://testserver//jobs" in message
    assert ['user@example.com'] == recipient


@pytest.mark.django_db(transaction=True)
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
            created=timezone.now() - datetime.timedelta(days=10),
        )
        job.created = timezone.now() - datetime.timedelta(days=10)
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


@pytest.mark.django_db(transaction=True)
def test_annotate_vcf(
    user_client: Client, test_grr: GenomicResourceRepo,
) -> None:
    user = User.objects.get(email="user@example.com")

    annotation_config = "- position_score: scores/pos1"
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """).strip()

    response = user_client.post(
        "/api/jobs/annotate_vcf",
        {
            "config": ContentFile(annotation_config),
            "data": ContentFile(vcf, "test_input.vcf")
        },
    )
    assert response.status_code == 200

    assert Job.objects.filter(owner=user).count() == 2

    job = Job.objects.last()

    assert job is not None

    saved_input = pathlib.Path(job.input_path)

    assert job.duration is not None
    assert job.duration < 7.0
    assert saved_input.exists()
    assert saved_input.read_text(encoding="utf-8") == vcf

    saved_config = pathlib.Path(job.config_path)
    assert saved_config.exists()
    assert saved_config.read_text(encoding="utf-8") == annotation_config

    result_path = pathlib.Path(job.result_path)
    assert result_path.parent == \
        pathlib.Path(settings.JOB_RESULT_STORAGE_DIR) / user.email
    assert result_path.exists()
    assert job.result_path.endswith(".vcf") is True


@pytest.mark.django_db(transaction=True)
def test_annotate_vcf_bad_config(user_client: Client) -> None:
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
        "/api/jobs/annotate_vcf",
        {
            "config": ContentFile(raw_img),
            "data": ContentFile(vcf)
        },
    )
    assert len(Job.objects.all()) == 2
    assert response.status_code == 400


@pytest.mark.django_db(transaction=True)
def test_annotate_vcf_bad_input_data(user_client: Client) -> None:
    user = User.objects.get(email="user@example.com")

    assert Job.objects.filter(owner=user).count() == 1

    with open(str(
            pathlib.Path(__file__).parent /
            "fixtures" / "GIMP_Pepper.png"), "rb") as image:
        raw_img = image.read()

    assert len(Job.objects.all()) == 2
    response = user_client.post(
        "/api/jobs/annotate_vcf",
        {
            "config": ContentFile("- sample_annotator: sample_resource"),
            "data": ContentFile(raw_img)
         },
    )
    assert len(Job.objects.all()) == 2
    assert response.status_code == 400


@pytest.mark.django_db(transaction=True)
def test_annotate_vcf_non_vcf_input_data(user_client: Client) -> None:
    user = User.objects.get(email="user@example.com")

    assert Job.objects.filter(owner=user).count() == 1

    assert len(Job.objects.all()) == 2
    response = user_client.post(
        "/api/jobs/annotate_vcf",
        {
            "config": ContentFile("sample_annotator: sample_resource"),
            "data": ContentFile("blabla random text")
         },
    )
    assert len(Job.objects.all()) == 2
    assert response.status_code == 400


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(
    "data, response_body",
    [
        (
            {
                "file_columns": ["chrom", "pos", "ref", "alt"],
                "column_mapping": {
                    "col_chrom": "chrom",
                    "col_pos": "pos",
                    "col_ref": "ref",
                    "col_alt": "alt",
                },
            },
            {"errors": ""},
        ),
        (
            {
                "file_columns": ["var", "loc"],
                "column_mapping": {
                    "col_location": "loc",
                    "col_variant": "var",
                },
            },
            {"errors": ""},
        ),
        (
            {
                "file_columns": ["chr", "ps"],
                "column_mapping": {
                    "col_chrom": "chr",
                    "col_pos": "ps",
                },
            },
            {"errors": ""},
        ),
        (
            {
                "file_columns": ["chr", "pos", "vr"],
                "column_mapping": {
                    "col_chrom": "chr",
                    "col_pos": "pos",
                    "col_variant": "vr",
                },
            },
            {"errors": ""},
        ),
        (
            {
                "file_columns": ["chr", "beg", "end"],
                "column_mapping": {
                    "col_chrom": "chr",
                    "col_pos_beg": "beg",
                    "col_pos_end": "end",
                },
            },
            {"errors": ""},
        ),
        (
            {
                "file_columns": ["chr", "pos_beg", "pos_end", "type"],
                "column_mapping": {
                    "col_chrom": "chr",
                    "col_pos_beg": "pos_beg",
                    "col_cnv_type": "type",
                },
            },
            {"errors": ""},
        ),
        (
            {
                "file_columns": ["vcf"],
                "column_mapping": {
                    "col_vcf_like": "vcf",
                },
            },
            {"errors": ""},
        ),
        (
            {
                "file_columns": ["chr", "pos_beg", "pos_end"],
                "column_mapping": {},
            },
            {"errors": "No columns selected from the file!"},
        ),
        (
            {
                "file_columns": ["chr", "pos_beg", "pos_end"],
                "column_mapping": {"col_special": "chr"},
            },
            {"errors": "Invalid column specification!"},
        ),
        (
            {
                "file_columns": [],
                "column_mapping": {
                    "col_vcf_like": "vcf",
                },
            },
            {"errors": "File header must be provided for column validation!"},
        ),
        (
            {
                "file_columns": ["chr", "pos_beg"],
                "column_mapping": {
                    "col_chrom": "chr",
                    "col_pos_beg": "pos_beg",
                },
            },
            {"errors": "Specified set of columns cannot be used together!"},
        ),
    ],
)
def test_validate_columns(
    admin_client: Client,
    data: dict[str, Any],
    response_body: dict[str, str],
) -> None:
    response = admin_client.post(
        "/api/validate_columns",
        data,
        content_type="application/json",
    )
    assert response.json() == response_body


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(
    "input_file, separator, specification, expected_lines, file_extension",
    [
        (
            textwrap.dedent("""
                chrom	pos	ref	alt
                chr1	1	C	A
            """),
            "\t",
            {
                "col_chrom": "chrom",
                "col_pos": "pos",
                "col_ref": "ref",
                "col_alt": "alt",
            },
            [
                ["chrom", "pos", "ref", "alt", "pos1"],
                ["chr1", "1", "C", "A", "0.1"],
            ],
            ".tsv",
        ),
        (
            textwrap.dedent("""
                chrom,pos,ref,alt
                chr1,1,C,A
            """),
            ",",
            {
                "col_chrom": "chrom",
                "col_pos": "pos",
                "col_ref": "ref",
                "col_alt": "alt",
            },
            [
                ["chrom", "pos", "ref", "alt", "pos1"],
                ["chr1", "1", "C", "A", "0.1"],
            ],
            ".csv",
        ),
        (
            textwrap.dedent("""
                loc,var
                chr1:999,del(3)
            """),
            ",",
            {
                "col_location": "loc",
                "col_variant": "var",
            },
            [
                ['loc', 'var', 'pos1'],
                ['chr1:999', 'del(3)', '']
            ],
            ".csv",
        ),
        (
            textwrap.dedent("""
                chr,ps
                chr1,666
            """),
            ",",
            {
                "col_chrom": "chr",
                "col_pos": "ps",
            },
            [
                ['chr', 'ps', 'pos1'],
                ['chr1', '666', '']
            ],
            ".csv",
        ),
        (
            textwrap.dedent("""
                chr,pos,vr
                chr1,999,sub(T->C)
            """),
            ",",
            {
                "col_chrom": "chr",
                "col_pos": "pos",
                "col_variant": "vr",
            },
            [
                ['chr', 'pos', 'vr', 'pos1'],
                ['chr1', '999', 'sub(T->C)', '']
            ],
            ".csv",
        ),
        (
            textwrap.dedent("""
                chr,beg,end
                chr1,5,10
            """),
            ",",
            {
                "col_chrom": "chr",
                "col_pos_beg": "beg",
                "col_pos_end": "end",
            },
            [
                ['chr', 'beg', 'end', 'pos1'],
                ['chr1', '5', '10', '0.35']
            ],
            ".csv",
        ),
        (
            textwrap.dedent("""
                chr,pos_beg,pos_end,cnv
                chr1,7,20,cnv+
            """),
            ",",
            {
                "col_chrom": "chr",
                "col_pos_beg": "pos_beg",
                "col_pos_end": "pos_end",
                "col_cnv_type": "end",
            },
            [
                ['chr', 'pos_beg', 'pos_end', 'cnv', 'pos1'],
                ['chr1', '7', '20', 'cnv+', '0.483']
            ],
            ".csv",
        ),
        (
            textwrap.dedent("""
                vcf
                chr1:5:C:CT
            """),
            None,
            {
                "col_vcf_like": "vcf",
            },
            [
                ['vcf', 'pos1'],
                ['chr1:5:C:CT', '0.25']
            ],
            ".txt",
        ),
    ],
)
def test_annotate_columns(
    admin_client: Client,
    input_file: str,
    separator: str | None,
    specification: dict[str, str],
    expected_lines: list[list[str]],
    file_extension: str,
) -> None:
    annotation_config = "- position_score: scores/pos1"
    file = input_file.strip()

    params = {
        "config": ContentFile(annotation_config),
        "data": ContentFile(file, "test_input.tsv"),
        **specification,
    }
    if separator is not None:
        params["separator"] = separator
    if "col_variant" in specification or "col_location" in specification:
        params["genome"] = "hg38"

    response = admin_client.post("/api/jobs/annotate_columns", params)

    assert response is not None
    assert response.status_code == 200

    user = User.objects.get(email="admin@example.com")
    assert Job.objects.filter(owner=user).count() == 2
    job = Job.objects.last()
    assert job is not None

    assert job.status == Job.Status.SUCCESS
    assert job.duration is not None
    assert job.duration < 6.0

    assert job.result_path.endswith(file_extension) is True

    output = pathlib.Path(job.result_path).read_text(encoding="utf-8")
    lines = [line.split(separator) for line in output.strip().split("\n")]
    assert lines == expected_lines


@pytest.mark.django_db(transaction=True)
def test_annotate_columns_t4c8(
    admin_client: Client,
) -> None:
    annotation_config = "- position_score: scores/pos1"
    file = textwrap.dedent("""
        chrom,pos,var
        chr1,9,del(3)
    """).strip()

    params = {
        "genome": "t4c8",
        "config": ContentFile(annotation_config),
        "data": ContentFile(file, "test_input.tsv"),
        "col_chrom": "chrom",
        "col_pos": "pos",
        "col_variant": "var",
    }
    params["separator"] = ","

    response = admin_client.post("/api/jobs/annotate_columns", params)

    assert response is not None
    assert response.status_code == 200

    user = User.objects.get(email="admin@example.com")
    assert Job.objects.filter(owner=user).count() == 2
    job = Job.objects.last()
    assert job is not None

    assert job.status == Job.Status.SUCCESS
    assert job.duration is not None
    assert job.duration < 7.0
    assert job.command_line.startswith("annotate_columns")
    assert job.command_line.find("job-inputs/admin@example.com") > 0
    assert job.command_line.find("annotation-configs/admin@example.com") > 0
    assert job.command_line.find("job-results/admin@example.com") > 0
    assert job.command_line.find(
        "--reference-genome-resource-id t4c8/t4c8_genome") > 0
    assert job.command_line.find("--col-chrom chrom") > 0
    assert job.command_line.find("--col-pos pos") > 0
    assert job.command_line.find("--col-variant var") > 0
    assert job.command_line.find(
        "--input-separator , --output-separator ,") > 0
    assert job.command_line.find("--grr-filename") > 0
    assert job.command_line.find("grr_definition.yaml") > 0

    output = pathlib.Path(job.result_path).read_text(encoding="utf-8")
    lines = [line.split(",") for line in output.strip().split("\n")]
    assert lines == [
        ['chrom', 'pos', 'var', 'pos1'],
        ['chr1', '9', 'del(3)', '0.425']
    ]


@pytest.mark.django_db(transaction=True)
def test_annotate_columns_t4c8_gzipped(
    admin_client: Client,
) -> None:
    annotation_config = "- position_score: scores/pos1"
    file = gzip.compress(textwrap.dedent("""
        chrom,pos,var
        chr1,9,del(3)
    """).strip().encode("utf-8"))

    params = {
        "genome": "t4c8",
        "config": ContentFile(annotation_config),
        "data": ContentFile(file, "test_input.tsv.gz"),
        "col_chrom": "chrom",
        "col_pos": "pos",
        "col_variant": "var",
        "separator": ",",
    }

    response = admin_client.post("/api/jobs/annotate_columns", params)

    assert response is not None
    assert response.status_code == 200

    user = User.objects.get(email="admin@example.com")
    assert Job.objects.filter(owner=user).count() == 2
    job = Job.objects.last()
    assert job is not None

    assert job.status == Job.Status.SUCCESS
    assert job.duration is not None
    assert job.duration < 7.0

    result_path = pathlib.Path(job.result_path)
    assert job.result_path.endswith(".gz"), str(result_path)
    assert result_path.exists(), str(result_path)
    output = gzip.decompress(
        pathlib.Path(job.result_path).read_bytes()).decode("utf-8")
    lines = [line.split(",") for line in output.strip().split("\n")]
    assert lines == [
        ['chrom', 'pos', 'var', 'pos1'],
        ['chr1', '9', 'del(3)', '0.425']
    ]


@pytest.mark.django_db(transaction=True)
def test_annotate_vcf_gzip_fails(
    user_client: Client, test_grr: GenomicResourceRepo,
) -> None:
    user = User.objects.get(email="user@example.com")

    assert Job.objects.filter(owner=user).count() == 1

    annotation_config = "- position_score: scores/pos1"
    vcf = gzip.compress(textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """).strip().encode())

    response = user_client.post(
        "/api/jobs/annotate_vcf",
        {
            "config": ContentFile(annotation_config),
            "data": ContentFile(vcf, "test_input.vcf.gz")
        },
    )
    assert response.status_code == 400

    assert Job.objects.filter(owner=user).count() == 1


@pytest.mark.django_db(transaction=True)
def test_annotate_vcf_bgzip(
    user_client: Client, test_grr: GenomicResourceRepo,
    tmp_path: pathlib.Path,
) -> None:
    user = User.objects.get(email="user@example.com")

    assert Job.objects.filter(owner=user).count() == 1

    annotation_config = "- position_score: scores/pos1"
    test_dir = tmp_path / "vcf_gzip"
    test_dir.mkdir(parents=True, exist_ok=True)
    vcf_content = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """).strip()
    input_path = test_dir / "test_input.vcf"
    input_path.write_text(vcf_content)
    output_path = test_dir / "test_out.vcf"
    tabix_compress(str(input_path), str(output_path))
    vcf = output_path.read_bytes()

    response = user_client.post(
        "/api/jobs/annotate_vcf",
        {
            "config": ContentFile(annotation_config),
            "data": ContentFile(vcf, "test_input.vcf.gz")
        },
    )
    assert response.status_code == 200

    assert Job.objects.filter(owner=user).count() == 2

    job = Job.objects.last()
    assert job is not None

    saved_input = pathlib.Path(job.input_path)

    assert job.duration is not None
    assert job.duration < 7.0
    assert saved_input.exists()
    assert gzip.decompress(saved_input.read_bytes()).decode() == vcf_content

    saved_config = pathlib.Path(job.config_path)
    assert saved_config.exists()
    assert saved_config.read_text(encoding="utf-8") == annotation_config

    result_path = pathlib.Path(job.result_path)
    assert result_path.parent == \
        pathlib.Path(settings.JOB_RESULT_STORAGE_DIR) / user.email
    assert result_path.exists(), result_path
    assert job.result_path.endswith(".vcf.gz")
    output = gzip.decompress(result_path.read_bytes()).decode("utf-8").strip()
    expected = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##FILTER=<ID=PASS,Description="All filters passed">
        ##contig=<ID=chr1>
        ##pipeline_annotation_tool=GPF variant annotation.
        ##INFO=<ID=pos1,Number=A,Type=String,Description="test position score">
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	pos1=0.1
     """).strip()
    assert output == expected


@pytest.mark.django_db(transaction=True)
def test_annotate_columns_bad_request(admin_client: Client) -> None:
    annotation_config = "- position_score: scores/pos1"
    input_file = textwrap.dedent("""
        chrom;pos;ref;alt
        chr1;1;C;A
    """).strip()
    response = admin_client.post(
        "/api/jobs/annotate_columns",
        {
            "config": ContentFile(annotation_config),
            "data": ContentFile(input_file)
        },
    )

    assert response.status_code == 400


@pytest.mark.django_db(transaction=True)
def test_annotate_columns_bad_genome(admin_client: Client) -> None:
    annotation_config = "- position_score: scores/pos1"
    file = gzip.compress(textwrap.dedent("""
        chrom,pos,var
        chr1,9,del(3)
    """).strip().encode("utf-8"))

    params = {
        "genome": "goshonome",
        "config": ContentFile(annotation_config),
        "data": ContentFile(file, "test_input.tsv.gz"),
        "col_chrom": "chrom",
        "col_pos": "pos",
        "col_variant": "var",
        "separator": "\t",
    }

    response = admin_client.post("/api/jobs/annotate_columns", params)

    assert response.status_code == 404


@pytest.mark.django_db(transaction=True)
def test_user_create_pipeline(
    user_client: Client,
) -> None:
    user = User.objects.get(email="user@example.com")
    pipeline_config = "- position_score: scores/pos1"

    params = {
        "config": ContentFile(pipeline_config),
        "name": "test_pipeline",
    }

    assert Pipeline.objects.filter(owner=user).count() == 0

    response = user_client.post("/api/user_pipeline", params)

    assert response is not None
    assert response.status_code == 200
    assert response.json() == {"name": "test_pipeline"}
    assert Pipeline.objects.filter(owner=user).count() == 1
    pipeline = Pipeline.objects.last()
    assert pipeline is not None
    assert pipeline.name == "test_pipeline"
    output = pathlib.Path(pipeline.config_path).read_text(encoding="utf-8")
    assert output == "- position_score: scores/pos1"


@pytest.mark.django_db(transaction=True)
def test_user_create_anonymous_pipeline(
    user_client: Client,
) -> None:
    user = User.objects.get(email="user@example.com")
    pipeline_config = "- position_score: scores/pos1"

    params = {
        "config": ContentFile(pipeline_config),
    }

    assert Pipeline.objects.filter(owner=user).count() == 0

    response = user_client.post("/api/user_pipeline", params)

    assert response is not None
    assert response.status_code == 200
    anon_pipeline_name = response.json()["name"]
    assert Pipeline.objects.filter(owner=user).count() == 1
    pipeline = Pipeline.objects.last()
    assert pipeline is not None
    assert pipeline.name == anon_pipeline_name
    assert pipeline.name.startswith("pipeline-")
    assert pipeline.name.endswith(".yaml")
    output = pathlib.Path(pipeline.config_path).read_text(encoding="utf-8")
    assert output == "- position_score: scores/pos1"


@pytest.mark.django_db(transaction=True)
def test_user_update_pipeline(
    user_client: Client,
) -> None:
    user = User.objects.get(email="user@example.com")
    pipeline_config = "- position_score: scores/pos1"

    assert Pipeline.objects.filter(owner=user).count() == 0
    params = {"config": ContentFile(pipeline_config), "name": "test_pipeline"}
    response = user_client.post("/api/user_pipeline", params)

    assert response is not None
    assert response.status_code == 200
    assert response.json() == {"name": "test_pipeline"}
    assert Pipeline.objects.filter(owner=user).count() == 1
    pipeline = Pipeline.objects.last()
    assert pipeline is not None
    assert pipeline.name == "test_pipeline"
    output = pathlib.Path(pipeline.config_path).read_text(encoding="utf-8")
    assert output == "- position_score: scores/pos1"

    pipeline_config = "- position_score: scores/pos2"
    params = {"config": ContentFile(pipeline_config), "name": "test_pipeline"}
    response = user_client.post("/api/user_pipeline", params)

    assert response is not None
    assert response.status_code == 200
    assert response.json() == {"name": "test_pipeline"}
    assert Pipeline.objects.filter(owner=user).count() == 1
    pipeline = Pipeline.objects.last()
    assert pipeline is not None
    assert pipeline.name == "test_pipeline"
    output = pathlib.Path(pipeline.config_path).read_text(encoding="utf-8")
    assert output == "- position_score: scores/pos2"

@pytest.mark.django_db(transaction=True)
def test_user_delete_pipeline(
    user_client: Client,
) -> None:
    user = User.objects.get(email="user@example.com")
    pipeline_config = "- position_score: scores/pos1"

    params = {
        "config": ContentFile(pipeline_config),
        "name": "test-pipeline",
    }

    response = user_client.post("/api/user_pipeline", params)

    assert response is not None
    assert response.status_code == 200
    assert response.json() == {"name": "test-pipeline"}
    assert Pipeline.objects.filter(owner=user).count() == 1

    response = user_client.delete("/api/user_pipeline?name=test-pipeline")

    assert response is not None
    assert response.status_code == 204
    assert Pipeline.objects.filter(owner=user).count() == 0


@pytest.mark.django_db(transaction=True)
def test_user_get_pipeline(
    user_client: Client,
) -> None:
    user = User.objects.get(email="user@example.com")
    pipeline_config = "- position_score: scores/pos1"

    params = {
        "config": ContentFile(pipeline_config),
        "name": "test-pipeline",
    }

    response = user_client.post("/api/user_pipeline", params)

    assert response is not None
    assert response.status_code == 200
    assert response.json() == {"name": "test-pipeline"}
    assert Pipeline.objects.filter(owner=user).count() == 1

    response = user_client.get("/api/user_pipeline?name=test-pipeline")

    assert response is not None
    assert response.status_code == 200
    assert response.json() == {
        "name": "test-pipeline",
        "owner": "user@example.com",
        "pipeline": "- position_score: scores/pos1",
    }


@pytest.mark.django_db(transaction=True)
def test_user_create_pipeline_with_bad_name(
    user_client: Client,
) -> None:
    user = User.objects.get(email="user@example.com")
    pipeline_config = "- position_score: scores/pos1"

    params = {
        "config": ContentFile(pipeline_config),
        "name": "pipeline/test_pipeline",
    }
    response = user_client.post("/api/user_pipeline", params)
    assert response.json() == {
        "reason": "Pipeline with such name cannot be created or updated!",
    }
    assert response.status_code == 400
    assert Pipeline.objects.filter(owner=user).count() == 0

    params = {
        "config": ContentFile(pipeline_config),
        "name": "t4c8/t4c8_pipeline",
    }
    response = user_client.post("/api/user_pipeline", params)
    assert response.json() == {
        "reason": "Pipeline with such name cannot be created or updated!",
    }
    assert response.status_code == 400
    assert Pipeline.objects.filter(owner=user).count() == 0


@pytest.mark.django_db(transaction=True)
def test_get_pipelines(
    user_client: Client,
) -> None:
    user = User.objects.get(email="user@example.com")

    # Named pipeline
    pipeline_config = "- position_score: scores/pos1"
    params = {
        "config": ContentFile(pipeline_config),
        "name": "test-user-pipeline",
    }
    response = user_client.post("/api/user_pipeline", params)

    assert response is not None
    assert response.status_code == 200
    assert response.json() == {"name": "test-user-pipeline"}
    assert Pipeline.objects.filter(owner=user).count() == 1

    # Anonymous pipeline
    pipeline_config = "- position_score: scores/pos2"
    params = {
        "config": ContentFile(pipeline_config),
    }
    response = user_client.post("/api/user_pipeline", params)

    assert response is not None
    assert response.status_code == 200
    assert isinstance(response.json()["name"], str)
    assert Pipeline.objects.filter(owner=user).count() == 2

    response = user_client.get("/api/pipelines")
    pipelines = response.json()
    assert len(pipelines) == 3
    assert pipelines[0]["id"] == "pipeline/test_pipeline"
    assert pipelines[1]["id"] == "t4c8/t4c8_pipeline"
    assert pipelines[2]["id"] == "test-user-pipeline"
    assert pipelines[2]["content"] == "- position_score: scores/pos1"


@pytest.mark.django_db(transaction=True)
def test_get_pipelines_annonymous_user(
    user_client: Client,
    anonymous_client: Client,
) -> None:
    user = User.objects.get(email="user@example.com")
    pipeline_config = "- position_score: scores/pos1"
    params = {
        "config": ContentFile(pipeline_config),
        "name": "test-user-pipeline",
    }
    response = user_client.post("/api/user_pipeline", params)

    assert response is not None
    assert response.status_code == 200
    assert response.json() == {"name": "test-user-pipeline"}
    assert Pipeline.objects.filter(owner=user).count() == 1

    response = anonymous_client.get("/api/pipelines")
    pipelines = response.json()
    assert len(pipelines) == 2
    assert pipelines[0]["id"] == "pipeline/test_pipeline"
    assert pipelines[1]["id"] == "t4c8/t4c8_pipeline"


@pytest.mark.django_db(transaction=True)
def test_annotate_vcf_user_pipeline(
    user_client: Client, test_grr: GenomicResourceRepo,
) -> None:
    user = User.objects.get(email="user@example.com")
    pipeline_config = "- position_score: scores/pos1"
    params = {
        "config": ContentFile(pipeline_config),
        "name": "test-user-pipeline",
    }
    response = user_client.post("/api/user_pipeline", params)

    assert response is not None
    assert response.status_code == 200
    assert response.json() == {"name": "test-user-pipeline"}
    assert Pipeline.objects.filter(owner=user).count() == 1

    user = User.objects.get(email="user@example.com")

    assert Job.objects.filter(owner=user).count() == 1

    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """).strip()

    response = user_client.post(
        "/api/jobs/annotate_vcf",
        {
            "pipeline": "test-user-pipeline",
            "data": ContentFile(vcf, "test_input.vcf")
        },
    )
    assert response.status_code == 200

    assert Job.objects.filter(owner=user).count() == 2
    job = Job.objects.last()
    assert job is not None

    saved_config = pathlib.Path(job.config_path)
    assert saved_config.exists()
    assert saved_config.read_text(encoding="utf-8") == (
        "- position_score: scores/pos1"
    )

    result_path = pathlib.Path(job.result_path)
    assert result_path.exists()
