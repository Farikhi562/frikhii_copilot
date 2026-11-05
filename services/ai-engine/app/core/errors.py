from __future__ import annotations

from typing import Any


class AIEngineError(Exception):
    """Base class for errors that can be mapped to a safe API response."""

    code = "ai_engine_error"
    status_code = 500
    message = "The AI engine could not complete the request."

    def __init__(self, message: str | None = None, *, details: Any = None) -> None:
        super().__init__(message or self.message)
        self.safe_message = message or self.message
        self.details = details


class AuthenticationError(AIEngineError):
    code = "unauthorized"
    status_code = 401
    message = "A valid internal service token is required."


class PayloadTooLargeError(AIEngineError):
    code = "payload_too_large"
    status_code = 413
    message = "The request payload is too large."


class RateLimitError(AIEngineError):
    code = "rate_limited"
    status_code = 429
    message = "Too many generation requests. Try again shortly."


class LLMConfigurationError(AIEngineError):
    code = "llm_not_configured"
    status_code = 503
    message = "No LLM provider is configured."


class LLMTimeoutError(AIEngineError):
    code = "llm_timeout"
    status_code = 504
    message = "The language model did not respond in time."


class LLMUnavailableError(AIEngineError):
    code = "llm_unavailable"
    status_code = 502
    message = "The language model provider is temporarily unavailable."


class LLMRateLimitError(AIEngineError):
    code = "llm_rate_limited"
    status_code = 429
    message = "The language model provider is rate limiting requests."


class LLMResponseError(AIEngineError):
    code = "invalid_llm_response"
    status_code = 502
    message = "The language model returned an unusable response."


class ContentValidationError(AIEngineError):
    code = "invalid_generated_content"
    status_code = 422
    message = "The generated content did not pass structural validation."

    def __init__(self, message: str, *, details: Any = None) -> None:
        super().__init__(message, details=details)
