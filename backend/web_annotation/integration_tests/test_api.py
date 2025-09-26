import pathlib
import requests
import textwrap

from web_annotation.models import Job

from django.core.files.base import ContentFile


def test_annotate_with_position_score(
    transactional_db: None,
) -> None:
    session = requests.Session()

    login_url = "http://localhost:8000/api/login"

    body = {
        "email": "admin@example.com",
        "password": "secret",
    }

    response = session.post(
        login_url, json=body,
        timeout=30)

    assert response.status_code == 200

    annotation_config = "- allele_score: hg38/scores/CADD_v1.4"
    vcf = textwrap.dedent("""
##fileformat=VCFv4.2
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
##contig=<ID=chr14>
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	mom	dad	prb
chr14	21403214	.	T	C	.	.	.	GT	0/0	0/0	0/1
chr14	21393217	.	ACT	A	.	.	.	GT	0/1	0/0	0/1
chr14	21391016	.	A	AT	.	.	.	GT	0/1	0/1	0/1
    """).strip()

    response = session.post(
        "http://localhost:8000/api/jobs/create",
        files={
            "config": ContentFile(annotation_config), "data": ContentFile(vcf)
        },
        headers={"X-Csrftoken": session.cookies["csrftoken"]}
    )

    data_dir = pathlib.Path(__file__).parent / "fixtures" / "container_data"

    assert data_dir.exists()
    config_dir = data_dir / "annotation-configs"
    input_dir = data_dir / "job-inputs"
    results_dir = data_dir / "job-results"
    assert config_dir.exists()
    assert input_dir.exists()
    assert results_dir.exists()

    job = Job.objects.all()[0]
    job_config = config_dir / pathlib.Path(job.config_path).name
    job_input = input_dir / pathlib.Path(job.input_path).name
    job_result = results_dir / pathlib.Path(job.result_path).name
    assert job_config.exists()
    assert job_input.exists()
    assert job_result.exists()
