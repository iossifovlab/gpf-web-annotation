from django.contrib.auth.models import User
import pytest
from django.test import Client


pytestmark = pytest.mark.django_db


@pytest.fixture
def user_client(client: Client) -> Client:
    user = User.objects.create_user("test-user", "user@example.com", "secret")
    user.save()
    client.login(username="test-user", password="secret")
    return client


def test_get_jobs_empty(user_client: Client) -> None:
    response = user_client.get("/jobs/")
    assert response.status_code == 200
    assert response.json() == []
