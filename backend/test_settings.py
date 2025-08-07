from settings import *
import tempfile
import time

# Dir for all data storage
DATA_STORAGE_DIR = f"{tempfile.gettempdir()}/gpf-web-annotation-tests-data-{int(time.time())}"
# Subdir to store uploaded annotation configurations in
ANNOTATION_CONFIG_STORAGE_DIR = f"{DATA_STORAGE_DIR}/annotation-configs"
# Subdir to store uploaded files in before they are annotated
JOB_INPUT_STORAGE_DIR = f"{DATA_STORAGE_DIR}/job-inputs"
# Subdir to store results of annotation in
JOB_RESULT_STORAGE_DIR = f"{DATA_STORAGE_DIR}/job-results"
