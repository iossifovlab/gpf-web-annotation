from django.http.request import HttpRequest
from rest_framework import exceptions
from rest_framework.authentication import SessionAuthentication

from web_annotation.models import User, WebAnnotationAnonymousUser

class WebAnnotationAuthentication(SessionAuthentication):
    """Custom authentication class"""
    def authenticate(
        self,
        request: HttpRequest,
    ) -> tuple[User | WebAnnotationAnonymousUser, None]:
        """
        Returns a `User` if the request session currently has a logged in user.
        Otherwise returns `WebAnnotationAnonymousUser`.
        """

        successful_auth = super().authenticate(request)

        if successful_auth is None:
            ip = self.get_ip_from_request(request)
            anonymous_user = WebAnnotationAnonymousUser(ip=ip)
            return (anonymous_user, None)

        (user, _) = successful_auth
        if not isinstance(user, User):
            raise exceptions.AuthenticationFailed('User type not recognized')

        return (user, None)

    def get_ip_from_request(self, request: HttpRequest) -> str:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return str(ip)
