from __future__ import annotations

import hmac

from fastapi import Header

from app.core.config import get_settings
from app.core.errors import AuthenticationError


async def require_internal_token(
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
) -> None:
    """Constant-time check for the Go Core API shared secret.

    The AI Engine is an internal service. There is deliberately no public generation
    endpoint and no browser CORS configuration.
    """

    expected = get_settings().internal_service_token
    if not expected:
        raise AuthenticationError("Internal service authentication is not configured.")
    if not x_internal_token or not hmac.compare_digest(x_internal_token, expected):
        raise AuthenticationError()
