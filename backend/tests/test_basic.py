from django.test import Client


def test_basic(client: Client) -> None:
    response = client.get("/web_annotation/basic")
    assert response.status_code == 200
    assert response.json() == {
        "content": "hello",
    }
