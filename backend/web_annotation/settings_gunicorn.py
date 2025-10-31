# pylint: disable=wildcard-import,unused-wildcard-import
# flake8: noqa
from .settings_default import *


USERS_ACTIVATED_BY_DEFAULT = True
STATIC_ROOT = '/static/gpf/static'


LIMITS = {
    "daily_jobs": 50,
    "filesize": "64M",
    "variant_count": 1000,
}
