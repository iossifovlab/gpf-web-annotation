from .settings import *
import os
import pathlib
import tempfile
import time

test_dir = pathlib.Path(__file__).absolute().parent / "tests"
db_fixture_dir = test_dir / "fixtures" / "db"

# Dir for all data storage


DATA_STORAGE_DIR = str(test_dir / "fixtures" / "container-data")
if os.environ.get("TESTING_CONTAINER"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(db_fixture_dir / "test_db.sqlite3"),
            "TEST": {
                "NAME": str(db_fixture_dir / "test_db.sqlite3")
            },
        },
    }
else:
    db_fixture_dir.mkdir(exist_ok=True)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(db_fixture_dir / "test_db.sqlite3"),
            "TEST": {
                "NAME": str(db_fixture_dir / "test_db.sqlite3")
            },
        },
    }

# Subdir to store uploaded annotation configurations in
ANNOTATION_CONFIG_STORAGE_DIR = f"{DATA_STORAGE_DIR}/annotation-configs"
# Subdir to store uploaded files in before they are annotated
JOB_INPUT_STORAGE_DIR = f"{DATA_STORAGE_DIR}/job-inputs"
# Subdir to store results of annotation in
JOB_RESULT_STORAGE_DIR = f"{DATA_STORAGE_DIR}/job-results"
