# pylint: disable=W0621,C0114,C0116,W0212,W0613
import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from web_annotation.models import AnonymousUserQuota, User, UserQuota


@pytest.fixture
def user_quota() -> UserQuota:
    user = User.objects.get(email="user@example.com")
    quota = UserQuota(user=user)
    quota.reset_daily()
    quota.reset_monthly()
    return quota


@pytest.fixture
def anonymous_quota() -> AnonymousUserQuota:
    quota = AnonymousUserQuota(ip="127.0.0.1")
    quota.reset_daily()
    quota.reset_monthly()
    return quota


# --- add_units command ---

def test_add_units_command_adds_units_to_user_quota(
    user_quota: UserQuota,
) -> None:
    user = User.objects.get(email="user@example.com")
    before = user_quota.extra_jobs

    call_command("add_units", user.pk)

    user_quota.refresh_from_db()
    assert user_quota.extra_jobs == before + user_quota.get_monthly_job_max()


def test_add_units_command_raises_for_nonexistent_user() -> None:
    with pytest.raises(CommandError, match="does not exist"):
        call_command("add_units", 99999)


# --- refreshdaily command ---

def test_refreshdaily_resets_user_quota_daily_fields(
    user_quota: UserQuota,
) -> None:
    user_quota.daily_jobs = 0
    user_quota.daily_variants = 0
    user_quota.save()

    call_command("refreshdaily")

    user_quota.refresh_from_db()
    assert user_quota.daily_jobs == user_quota.get_daily_job_max()
    assert user_quota.daily_variants == user_quota.get_daily_variant_max()


def test_refreshdaily_resets_anonymous_quota_daily_fields(
    anonymous_quota: AnonymousUserQuota,
) -> None:
    anonymous_quota.daily_jobs = 0
    anonymous_quota.daily_variants = 0
    anonymous_quota.save()

    call_command("refreshdaily")

    anonymous_quota.refresh_from_db()
    assert anonymous_quota.daily_jobs == anonymous_quota.get_daily_job_max()
    assert anonymous_quota.daily_variants == anonymous_quota.get_daily_variant_max()


def test_refreshdaily_does_not_reset_monthly_fields(
    user_quota: UserQuota,
) -> None:
    user_quota.monthly_jobs = 0
    user_quota.save()

    call_command("refreshdaily")

    user_quota.refresh_from_db()
    assert user_quota.monthly_jobs == 0


# --- refreshmonthly command ---

def test_refreshmonthly_resets_user_quota_monthly_fields(
    user_quota: UserQuota,
) -> None:
    user_quota.monthly_jobs = 0
    user_quota.monthly_variants = 0
    user_quota.save()

    call_command("refreshmonthly")

    user_quota.refresh_from_db()
    assert user_quota.monthly_jobs == user_quota.get_monthly_job_max()
    assert user_quota.monthly_variants == user_quota.get_monthly_variant_max()


def test_refreshmonthly_resets_anonymous_quota_monthly_fields(
    anonymous_quota: AnonymousUserQuota,
) -> None:
    anonymous_quota.monthly_jobs = 0
    anonymous_quota.monthly_variants = 0
    anonymous_quota.save()

    call_command("refreshmonthly")

    anonymous_quota.refresh_from_db()
    assert anonymous_quota.monthly_jobs == anonymous_quota.get_monthly_job_max()
    assert anonymous_quota.monthly_variants == \
        anonymous_quota.get_monthly_variant_max()


def test_refreshmonthly_does_not_reset_daily_fields(
    user_quota: UserQuota,
) -> None:
    user_quota.daily_jobs = 0
    user_quota.save()

    call_command("refreshmonthly")

    user_quota.refresh_from_db()
    assert user_quota.daily_jobs == 0
