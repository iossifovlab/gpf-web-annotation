import pathlib
import shutil
import pytest
from django.test import Client
from django.conf import settings

from gpf_web_annotation_backend.models import Job, User


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
    db,
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
    client.login(email="admin@example.com", password="secret")
    return client


@pytest.fixture
def user_client() -> Client:
    client = Client()
    client.login(email="user@example.com", password="secret")
    return client
