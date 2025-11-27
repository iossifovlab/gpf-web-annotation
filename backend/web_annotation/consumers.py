# pylint: disable=W0201
import json
from typing import Any, cast
from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer

from web_annotation.models import User


class AnnotationStateConsumer(WebsocketConsumer):
    """Web socket consumer made for notifying users of job progress."""

    def get_user(self) -> User:
        assert "user" in self.scope, "User not found in scope"
        user = cast(User, self.scope["user"])
        assert user is not None, "User is None in scope"
        return user

    def connect(self) -> None:
        user = self.get_user()
        if user.is_anonymous:
            self.close()
        self.user_id = str(user.pk)
        async_to_sync(self.channel_layer.group_add)(
            self.user_id, self.channel_name)
        self.accept()

    def disconnect(self, code: Any) -> None:
        async_to_sync(self.channel_layer.group_discard)(
            self.user_id, self.channel_name)

    def annotation_notify(self, event: Any) -> None:
        self.send(
            text_data=json.dumps({"message": event["message"]})
        )
