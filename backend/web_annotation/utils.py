
from typing import Any

from django import forms
from django.conf import settings
from django.contrib.auth import password_validation
from django.contrib.auth.models import User
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy
from django.views.decorators.debug import sensitive_variables

from web_annotation.models import BaseVerificationCode, ResetPasswordCode
from web_annotation.tasks import send_email


class WdaePasswordForgottenForm(forms.Form):
    email = forms.EmailField(
        label="Email",
        max_length=254,
        widget=forms.EmailInput(attrs={"autocomplete": "email"}),
    )

def reset_password(user: User, redirect_url: str) -> None:
    verif_code = ResetPasswordCode.create(user)
    send_reset_email(user, verif_code, redirect_url)

def deauthenticate(user: User) -> None:
    all_sessions = Session.objects.all()
    for session in all_sessions:
        session_data = session.get_decoded()
        if user.pk == session_data.get("_auth_user_id"):
            session.delete()

def send_reset_email(
    user: User, verif_path: BaseVerificationCode, redirect_url: str,
) -> None:
    """Return dict with subject and message of the email."""
    # pylint: disable=import-outside-toplevel
    email = _create_reset_mail(
        settings.EMAIL_VERIFICATION_ENDPOINT,
        settings.EMAIL_VERIFICATION_RESET_PATH,
        str(verif_path.path),
        redirect_url,
    )
    send_email.delay(email["subject"], email["message"], [user.email])

def _create_reset_mail(
    endpoint: str, path: str, verification_path: str, redirect_url: str,
) -> dict[str, str]:
    """Create email template for password reset."""
    message = (
        "Hello. You have requested to reset your password for "
        "your GPF Web Annotation account. To do so, please "
        "follow the link below:\n {link}\n"
        "If you did not request for your GPF account password to be reset, "
        "please ignore this email."
    )
    email_settings = {
        "subject": "GPF: Password reset request",
        "initial_message": message,
        "endpoint": endpoint,
        "path": path,
        "verification_path": verification_path,
        "redirect": redirect_url,
    }

    return _build_email_template(email_settings)

def _build_email_template(email_settings: dict[str, str]) -> dict[str, str]:
    subject = email_settings["subject"]
    message = email_settings["initial_message"]
    path = email_settings["path"].format(
        email_settings["redirect"],
        email_settings["verification_path"],
    )

    message = message.format(link=f"{email_settings['endpoint']}{path}")

    return {"subject": subject, "message": message}

def create_password_fields(
    label1: Any = gettext_lazy("Password"),
    label2: Any = gettext_lazy("Password confirmation"),
) -> tuple[forms.CharField, forms.CharField]:
    """Create two password fields."""
    password1 = forms.CharField(
        label=label1,
        required=True,
        strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
        help_text=password_validation.password_validators_help_text_html(),
    )
    password2 = forms.CharField(
        label=label2,
        required=True,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
        strip=False,
        help_text=gettext_lazy(
            "Enter the same password as before, for verification.",
        ),
    )
    return password1, password2


class SetPasswordForm(forms.Form):
    """
    A form that lets a user set their password without entering the old
    password
    """

    new_password1, new_password2 = create_password_fields(
        label1=gettext_lazy("New password"),
        label2=gettext_lazy("New password confirmation"),
    )
    error_messages = {
        "password_mismatch": gettext_lazy(
            "The two password fields didn’t match.",
        ),
    }

    def __init__(self, user: User, *args: Any, **kwargs: Any) -> None:
        self.user = user
        super().__init__(*args, **kwargs)

    def clean(self) -> dict[str, Any] | None:
        self.validate_passwords("new_password1", "new_password2")
        self.validate_password_for_user(self.user, "new_password2")
        return super().clean()

    def save(self, commit: bool = True) -> User:
        return self.set_password_and_save(
            self.user,
            "new_password1",
            commit=commit,
        )

    @sensitive_variables("password1", "password2")
    def validate_passwords(
        self,
        password1_field_name: str = "password1",
        password2_field_name: str = "password2",
    ) -> None:
        """Validate that the two password entries match."""
        password1 = self.cleaned_data.get(password1_field_name)
        password2 = self.cleaned_data.get(password2_field_name)

        if password1 and password2 and password1 != password2:
            error = ValidationError(
                self.error_messages["password_mismatch"],
                code="password_mismatch",
            )
            self.add_error(password2_field_name, error)

    @sensitive_variables("password")
    def validate_password_for_user(
        self,
        user: User,
        password_field_name: str = "password2",
    ) -> None:
        """Validate the password."""
        password = self.cleaned_data.get(password_field_name)
        if password:
            try:
                password_validation.validate_password(password, user)
            except ValidationError as error:
                self.add_error(password_field_name, error)

    def set_password_and_save(
        self,
        user: User,
        password_field_name: str = "password1",
        commit: bool = True,
    ) -> User:
        """Set the user's password and save the user."""
        user.set_password(self.cleaned_data[password_field_name])
        if commit:
            user.save()
        return user


class WdaeResetPasswordForm(SetPasswordForm):
    """A form for users to reset their password when forgotten."""

    error_messages = {
        "password_invalid": gettext_lazy(
            "Your password is either too short "
            "(less than 10 symbols) or too weak.",
        ),
        "password_mismatch": gettext_lazy(
            "The two passwords do not match.",
        ),
    }
