import pathlib
import shutil
import yaml
import pytest
import pytest_mock
from django.test import Client
from django.conf import settings, LazySettings
from typing import Generator, cast
from urllib.parse import urlparse
from dae.genomic_resources.repository import GenomicResourceRepo
from dae.genomic_resources.repository_factory import \
    build_genomic_resource_repository

from web_annotation.tests.mailhog_client import MailhogClient
from web_annotation.models import Job, User


@pytest.fixture(autouse=True)
def clean_genomic_context(
    mocker: pytest_mock.MockerFixture,
) -> None:
    mocker.patch(
        "dae.genomic_resources.genomic_context._REGISTERED_CONTEXTS",
        [])


@pytest.fixture(scope="function", autouse=True)
def use_test_grr_definition(
    test_grr: GenomicResourceRepo, tmp_path: pathlib.Path,
    settings: LazySettings,
    mocker: pytest_mock.MockFixture,
) -> None:
    grr_path = tmp_path / "grr_definition.yaml"
    grr_path.write_text(yaml.safe_dump(test_grr.definition))
    settings.GRR_DEFINITION = grr_path

def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--url",
        dest="url",
        action="store",
        default="http://localhost:21011",
        help="REST API URL",
    )

    parser.addoption(
        "--mailhog",
        dest="mailhog",
        action="store",
        default="http://localhost:8025",
        help="Mailhog REST API URL",
    )


@pytest.fixture(scope="function")
def test_grr(mocker: pytest_mock.MockFixture) -> GenomicResourceRepo:
    grr_patch = \
        mocker.patch("web_annotation.views.AnnotationBaseView.get_grr")

    grr_patch.return_value = test_grr


@pytest.fixture(scope="function")
def test_grr() -> GenomicResourceRepo:
    grr_dir = pathlib.Path(__file__).parent / "fixtures" / "grr"
    grr = build_genomic_resource_repository(
        {
            "id": "test",
            "type": "dir",
            "directory": str(grr_dir)
        }
    )
    return grr


@pytest.fixture(scope="session", autouse=True)
def setup_data_dirs() -> Generator[None, None, None]:
    assert not pathlib.Path(settings.DATA_STORAGE_DIR).exists()
    pathlib.Path(settings.DATA_STORAGE_DIR).mkdir()
    pathlib.Path(settings.ANNOTATION_CONFIG_STORAGE_DIR).mkdir()
    pathlib.Path(settings.JOB_INPUT_STORAGE_DIR).mkdir()
    pathlib.Path(settings.JOB_RESULT_STORAGE_DIR).mkdir()
    yield
    shutil.rmtree(settings.DATA_STORAGE_DIR)


@pytest.fixture(autouse=True)
def setup_test_db(
    db: None,
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
        duration=1.0,
        command_line="annotate_vcf mock command line",
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
        duration=1.0,
        command_line="annotate_vcf mock command line",
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

@pytest.fixture
def anonymous_client() -> Client:
    client = Client()
    return client


@pytest.fixture
def mail_client(mailhog_url: str, settings: LazySettings) -> MailhogClient:
    """REST client fixture."""
    # Workaround for django test environment setup being hardcoded to
    # always set up a locmem backend
    settings.EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    return MailhogClient(mailhog_url)

@pytest.fixture
def mailhog_url(request: pytest.FixtureRequest) -> str:
    """Mailhog URL fixture."""
    res = cast(str, request.config.getoption("--mailhog"))
    parsed = urlparse(res)
    if not parsed.scheme:
        res = f"http://{res}"
    if parsed.scheme not in {"http", "https"}:
        raise ValueError(f"Invalid URL: {res}")
    parsed = urlparse(res)
    path = parsed.path.rstrip("/")
    return f"{parsed.scheme}://{parsed.netloc}{path}"
