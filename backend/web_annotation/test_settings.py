# pylint: disable=wildcard-import,unused-wildcard-import
import pathlib

import tempfile
import os
import time
import yaml
from .settings import *  # noqa


# Dir for all data storage
DATA_STORAGE_DIR = \
    f"{tempfile.gettempdir()}/gpf-web-annotation-tests-data-{int(time.time())}"
# Subdir to store uploaded annotation configurations in
ANNOTATION_CONFIG_STORAGE_DIR = f"{DATA_STORAGE_DIR}/annotation-configs"
# Subdir to store uploaded files in before they are annotated
JOB_INPUT_STORAGE_DIR = f"{DATA_STORAGE_DIR}/job-inputs"
# Subdir to store results of annotation in
JOB_RESULT_STORAGE_DIR = f"{DATA_STORAGE_DIR}/job-results"

CELERY_TASK_ALWAYS_EAGER = True

LIMITS = {
    "daily_jobs": 5,
    "filesize": "64M",
    "variant_count": 1000,
}


GRR_DIRECTORY = str(
    pathlib.Path(__file__).parent / "tests" / "fixtures" / "grr")

GRR_DEFINITION_PATH = str(
    pathlib.Path(GRR_DIRECTORY) / "grr_definition.yaml")
pathlib.Path(GRR_DEFINITION_PATH).write_text(yaml.safe_dump({
    "id": "test",
    "type": "dir",
    "directory": GRR_DIRECTORY,
}))

GENOME_DEFINITIONS = {
    "hg38": {
        "pipeline_id": "pipeline/test_pipeline",
        "reference_genome_id": "hg38/GRCh38-hg38/genome"
    },
    "t4c8": {
        "pipeline_id": "t4c8/t4c8_pipeline",
        "reference_genome_id": "t4c8/t4c8_genome"
    },
}

RESOURCES_BASE_URL = "http://test/"

EMAIL_REDIRECT_ENDPOINT = os.environ.get(
    "GPFWA_EMAIL_REDIRECT_ENDPOINT", "http://testserver/")

JOB_CLEANUP_INTERVAL_DAYS = 7
