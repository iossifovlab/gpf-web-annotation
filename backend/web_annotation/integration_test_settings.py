"""Settings module for use in integration tests."""
# pylint: skip-file
import os
import pathlib
from .settings import *

test_dir = pathlib.Path(__file__).absolute().parent / "tests"
db_fixture_dir = test_dir / "fixtures" / "db"

# Dir for all data storage


DATA_STORAGE_DIR = str(test_dir / "fixtures" / "container-data")
if os.environ.get("TESTING_CONTAINER"):
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

if os.environ.get("TESTING_CONTAINER"):
    for root, dirs, files in os.walk(str(DATA_STORAGE_DIR)):
        for cur_dir in dirs:
            os.chmod(os.path.join(root, cur_dir), 777)
        for cur_file in files:
            os.chmod(os.path.join(root, cur_file), 777)
