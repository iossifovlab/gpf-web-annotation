from pathlib import Path
import shutil
from typing import Generator

import pytest
from django.test import Client
from pytest_django import DjangoDbBlocker
from django.conf import settings
from web_annotation.models import Job, User


@pytest.fixture(scope="session", autouse=True)
def setup_data_dirs() -> Generator[None, None, None]:
    import pdb; pdb.set_trace()
    Path(settings.DATA_STORAGE_DIR).mkdir(exist_ok=True)
    Path(settings.ANNOTATION_CONFIG_STORAGE_DIR).mkdir(exist_ok=True)
    Path(settings.JOB_INPUT_STORAGE_DIR).mkdir(exist_ok=True)
    Path(settings.JOB_RESULT_STORAGE_DIR).mkdir(exist_ok=True)
    yield
    import pdb; pdb.set_trace()
    shutil.rmtree(settings.DATA_STORAGE_DIR)


def rm_tree(path: Path, *, keep: bool = False) -> None:
    for child in path.iterdir():
        if child.is_file():
            child.unlink()
        else:
            rm_tree(child)
    if not keep:
        path.rmdir()


@pytest.fixture(scope='function')
def django_db_setup(
    django_db_setup: None,
    django_db_blocker: DjangoDbBlocker,
) -> Generator[None, None, None]:
    vcf_input_dir = Path(settings.JOB_INPUT_STORAGE_DIR)
    config_input_dir = Path(settings.ANNOTATION_CONFIG_STORAGE_DIR)
    result_dir = Path(settings.JOB_RESULT_STORAGE_DIR)
    with django_db_blocker.unblock():
        User.objects.all().delete()
        Job.objects.all().delete()
        user = User.objects.create_user(
            "test-user",
            "user@example.com",
            "secret",
        )
        user.save()
        user_input = vcf_input_dir / "user-input.vcf"
        user_input.write_text("mock vcf data")
        user_config = config_input_dir / "user-config.yaml"
        user_config.write_text("mock annotation config")
        user_result = result_dir / "user-result.vcf"
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
        admin_input = vcf_input_dir / "admin-input.vcf"
        admin_input.write_text("mock vcf data 2")
        admin_config = config_input_dir / "admin-config.yaml"
        admin_config.write_text("mock annotation config 2")
        admin_result = result_dir / "admin-result.vcf"
        admin_result.write_text("mock annotated vcf 2")
        Job(
            input_path=admin_input,
            config_path=admin_config,
            result_path=admin_result,
            owner=admin,
        ).save()
    yield

    with django_db_blocker.unblock():
        User.objects.all().delete()
        Job.objects.all().delete()

    rm_tree(vcf_input_dir, keep=True)
    rm_tree(config_input_dir, keep=True)
    rm_tree(result_dir, keep=True)


@pytest.fixture(scope="session")
def django_db_keepdb() -> bool:
    return True


@pytest.fixture
def admin_client(transactional_db: None) -> Client:
    client = Client()
    client.login(email="admin@example.com", password="secret")
    return client


@pytest.fixture
def user_client(transactional_db: None) -> Client:
    client = Client()
    client.login(email="user@example.com", password="secret")
    return client
