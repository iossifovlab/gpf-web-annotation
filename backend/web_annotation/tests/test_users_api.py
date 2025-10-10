import time
from django.test import Client
import pytest
from web_annotation.models import User
import re
from web_annotation.tests.mailhog_client import (
    MailhogClient,
)


def test_get_users(admin_client: Client) -> None:
    response = admin_client.get("/api/users")
    assert response.status_code == 200
    assert response.json() == [
        {"email": "user@example.com", "jobs": [1]},
        {"email": "admin@example.com", "jobs": [2]},
    ]


def test_get_users_unauthorized(user_client: Client) -> None:
    response = user_client.get("/api/users")
    assert response.status_code == 403


def test_get_user_details(admin_client: Client) -> None:
    response = admin_client.get("/api/users/1")
    assert response.status_code == 200
    assert response.json() == {"email": "user@example.com", "jobs": [1]}


def test_get_user_details_unauthorized(user_client: Client) -> None:
    response = user_client.get("/api/users/1")
    assert response.status_code == 403


def test_register(client: Client) -> None:
    response = client.post(
        "/api/register",
        {
            "email": "gosho@example.com",
            "password": "secret",
            "redirect": "http://testserver/",
        },
        content_type="application/json",
    )
    assert response.status_code == 200
    assert User.objects.filter(email="gosho@example.com").exists()


def test_register_and_activate_account(
    client: Client,
    mail_client: MailhogClient,
) -> None:
    mail_client.delete_all_messages()
    time.sleep(0.5)

    response = client.post(
        "/api/register",
        {
            "email": "temp@example.com",
            "password": "secret",
            "redirect": "http://testserver/",
        },
        content_type="application/json",
    )
    
    assert response.status_code == 200
    assert User.objects.filter(email="temp@example.com").exists()

    message = mail_client.find_message_to_user("temp@example.com")
    assert "/confirm_account?redirect=http://testserver/&code=" \
        in message["Content"]["Body"]

    confirmation_link_search = re.search(
        "new account:\r\n (.*)",
        message["Content"]["Body"],
    )
    assert confirmation_link_search is not None

    confirmation_link = confirmation_link_search.group(1)
    response = client.get(confirmation_link)
    assert response.status_code == 302
    assert response['Location'] == "http://testserver/"

    assert client.login(
        email="temp@example.com",
        password="secret"
    ) is True


def test_register_email_taken(client: Client) -> None:
    response = client.post(
        "/api/register",
        {"email": "user@example.com",
         "password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json() == {
        "error": "This email is already in use",
    }


def test_register_bad_requests(client: Client) -> None:
    response = client.post(
        "/api/register",
        {"email": "gosho@example.com"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json() == {
        "error": "A password is required to register",
    }

    response = client.post(
        "/api/register",
        {"password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json() == {
        "error": "An email is required to register",
    }


def test_login(client: Client) -> None:
    response = client.post(
        "/api/login",
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
        "/api/login",
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
        "/api/login",
        {"email": "user@example.com",
         "password": "alabala"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json() == {
        "error": "Invalid login credentials",
    }


def test_login_user_does_not_exist(client: Client) -> None:
    response = client.post(
        "/api/login",
        {"email": "user-two@example.com",
         "password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json() == {
        "error": "Invalid login credentials",
    }


def test_login_bad_requests(client: Client) -> None:
    response = client.post(
        "/api/login",
        {"email": "user@example.com"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json() == {
        "error": "A password is required to log in",
    }

    response = client.post(
        "/api/login",
        {"password": "secret"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json() == {
        "error": "An email is required to log in",
    }


def test_load_of_reset_password_form(
    user_client: Client,
) -> None:
    response = user_client.post(
        "/api/forgotten_password",
        {"email": "user@example.com"},
    )
    assert response.status_code == 200

    response = user_client.post(
        "/api/forgotten_password",
        {"email": "random@example.com"},
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_reset_password_email(
    user_client: Client,
    mail_client: MailhogClient,
) -> None:
    mail_client.delete_all_messages()
    time.sleep(0.5)

    # Set redirect link first
    response = user_client.get(
        "/api/forgotten_password?redirect=http://testserver/",
    )
    response = user_client.post(
        "/api/forgotten_password",
        {"email": "user@example.com"},
    )
    assert response.status_code == 200

    time.sleep(0.5)
    emails = mail_client.get_all_messages()
    assert emails["total"] != 0

    message = mail_client.find_message_to_user("user@example.com")
    assert "/reset_password?redirect=http://testserver/&code=" \
        in message["Content"]["Body"]


@pytest.mark.django_db
def test_load_reset_password_form(
    user_client: Client,
    client: Client,
    mail_client: MailhogClient,
) -> None:
    mail_client.delete_all_messages()
    time.sleep(0.5)

    response = user_client.post(
        "/api/forgotten_password",
        {"email": "user@example.com"},
    )
    assert response.status_code == 200

    time.sleep(0.5)

    message = mail_client.find_message_to_user("user@example.com")
    link_search = re.search(
        ":8000(.*)\r\n",
        message["Content"]["Body"],
    )
    assert link_search is not None

    reset_password_form_link = link_search.group(1)

    response = client.get(reset_password_form_link)

    assert response.status_code == 200

    template_html = response.content.decode("utf-8")

    form_action_search = re.search(
        '<form method="post" action="(.*)">\n',
        template_html,
    )
    assert form_action_search is not None
    assert form_action_search.group(1) == "/api/reset_password"


@pytest.mark.django_db
def test_reset_password_form(
    user_client: Client,
    client: Client,
    mail_client: MailhogClient,
) -> None:
    user = User.objects.create_user(
        "temp-user",
        "temp@example.com",
        "secret",
    )
    user.save()

    mail_client.delete_all_messages()
    time.sleep(0.5)

    response = user_client.get(
        "/api/forgotten_password?redirect=http://testserver/",
    )
    response = user_client.post(
        "/api/forgotten_password",
        {"email": "temp@example.com"},
    )
    assert response.status_code == 200

    message = mail_client.find_message_to_user("temp@example.com")
    code_search = re.search(
        "code=(.*)\r\n",
        message["Content"]["Body"],
    )
    assert code_search is not None

    code = code_search.group(1)

    response = user_client.post(
        "/api/reset_password",
        data={
            "code": code,
            "redirect": "http://testserver/",
            "new_password1": "newsecret",
            "new_password2": "newsecret",
        },
    )
    assert response.status_code == 302
    assert response['Location'] == "http://testserver/"
    assert client.login(
        email="temp@example.com",
        password="newsecret"
    ) is True
