# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Test Settings"""

from .common import *  # noqa

DEBUG = True

# Send it in a dummy outbox
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Keep request throttles and other caches isolated from previous test runs.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "plane-tests",
    }
}

INSTALLED_APPS.append(  # noqa
    "plane.tests"
)
