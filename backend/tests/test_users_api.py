from django.test import Client

from web_annotation.models import User


def test_get_users(admin_client: Client) -> None:
    response = admin_client.get("/users/")
    assert response.status_code == 200
    assert response.json() == [
        {"email": "user@example.com", "jobs": [1]},
        {"email": "admin@example.com", "jobs": [2]},
    ]


def test_get_users_unauthorized(user_client: Client) -> None:
    response = user_client.get("/users/")
    assert response.status_code == 403


def test_get_user_details(admin_client: Client) -> None:
    response = admin_client.get("/users/1/")
    assert response.status_code == 200
    assert response.json() == {"email": "user@example.com", "jobs": [1]}


def test_get_user_details_unauthorized(user_client: Client) -> None:
    response = user_client.get("/users/1/")
    assert response.status_code == 403


def test_register(client: Client) -> None:
    response = client.post(
        "/register/",
        {"email": "gosho@example.com",
         "password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert User.objects.filter(email="gosho@example.com").exists()


def test_register_email_taken(client: Client) -> None:
    response = client.post(
        "/register/",
        {"email": "user@example.com",
         "password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_register_bad_requests(client: Client) -> None:
    response = client.post(
        "/register/",
        {"email": "gosho@example.com"},
        content_type="application/json",
    )
    assert response.status_code == 400

    response = client.post(
        "/register/",
        {"password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_login(client: Client) -> None:
    response = client.post(
        "/login/",
        {"email": "user@example.com",
         "password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json() == {
        "email": "user@example.com",
        "isAdmin": False,
    }

    assert "sessionid" in response.cookies
    assert response.cookies["sessionid"]

    assert "csrftoken" in response.cookies
    assert response.cookies["csrftoken"]


def test_login_admin(client: Client) -> None:
    response = client.post(
        "/login/",
        {"email": "admin@example.com",
         "password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json() == {
        "email": "admin@example.com",
        "isAdmin": True,
    }

    assert "sessionid" in response.cookies
    assert response.cookies["sessionid"]

    assert "csrftoken" in response.cookies
    assert response.cookies["csrftoken"]


def test_login_user_wrong_password(client: Client) -> None:
    response = client.post(
        "/login/",
        {"email": "user@example.com",
         "password": "alabala"},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_login_user_does_not_exist(client: Client) -> None:
    response = client.post(
        "/login/",
        {"email": "user-two@example.com",
         "password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_login_bad_requests(client: Client) -> None:
    response = client.post(
        "/login/",
        {"email": "user@example.com"},
        content_type="application/json",
    )
    assert response.status_code == 400

    response = client.post(
        "/login/",
        {"password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 400
