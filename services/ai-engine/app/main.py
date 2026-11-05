from __future__ import annotations

import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes import router as internal_router
from app.core.config import get_settings
from app.core.errors import AIEngineError, PayloadTooLargeError, RateLimitError
from app.core.ratelimit import FixedWindowLimiter

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("frikhii.ai")

app = FastAPI(
    title="FRIKHII Copilot AI Engine",
    version="0.3.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None if settings.app_env == "production" else "/openapi.json",
)
_limiter = FixedWindowLimiter(settings.rate_limit_per_minute)


def _error_response(
    status_code: int,
    code: str,
    message: str,
    *,
    request_id: str | None = None,
    details: object = None,
) -> JSONResponse:
    body: dict[str, object] = {"error": {"code": code, "message": message}}
    if request_id:
        body["error"]["request_id"] = request_id  # type: ignore[index]
    if details is not None:
        body["error"]["details"] = details  # type: ignore[index]
    return JSONResponse(status_code=status_code, content=body)


@app.middleware("http")
async def guard_requests(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    if request.url.path.startswith("/internal/"):
        if len(await request.body()) > settings.max_request_bytes:
            return _error_response(
                413,
                PayloadTooLargeError.code,
                PayloadTooLargeError.message,
                request_id=request_id,
            )
        client_key = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
        allowed, retry_after = _limiter.allow(client_key)
        if not allowed:
            response = _error_response(
                429,
                RateLimitError.code,
                RateLimitError.message,
                request_id=request_id,
            )
            response.headers["Retry-After"] = str(max(1, int(retry_after)))
            return response

    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time-Ms"] = str(int((time.perf_counter() - started) * 1000))
    return response


@app.exception_handler(AIEngineError)
async def ai_engine_error_handler(request: Request, exc: AIEngineError):
    request_id = request.headers.get("x-request-id")
    logger.warning(
        "ai_engine_error code=%s status=%s request_id=%s detail=%s",
        exc.code,
        exc.status_code,
        request_id,
        exc.safe_message,
    )
    return _error_response(
        exc.status_code,
        exc.code,
        exc.safe_message,
        request_id=request_id,
        details=exc.details,
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors()[:20]:
        location = ".".join(str(part) for part in error.get("loc", ()))
        errors.append({"field": location, "message": error.get("msg", "invalid value")})
    return _error_response(
        422,
        "invalid_request",
        "The request did not match the expected schema.",
        request_id=request.headers.get("x-request-id"),
        details={"errors": errors},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.exception("unhandled_error request_id=%s", request.headers.get("x-request-id"))
    return _error_response(
        500,
        "internal_error",
        "The AI engine encountered an unexpected error.",
        request_id=request.headers.get("x-request-id"),
    )


@app.get("/health")
async def health() -> dict[str, object]:
    provider = get_settings()
    return {
        "status": "ok",
        "service": "frikhii-ai-engine",
        "version": "0.3.0",
        "environment": provider.app_env,
        "provider": provider.llm_provider,
        "model": provider.llm_model or ("mock" if provider.uses_mock_provider else ""),
        "mock_provider": provider.uses_mock_provider,
        "fallback_configured": provider.fallback_configured,
    }


@app.get("/ready")
async def ready() -> dict[str, str]:
    return {"status": "ready"}


app.include_router(internal_router)
