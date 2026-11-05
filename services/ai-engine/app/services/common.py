from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from typing import Any, Callable, TypeVar

from pydantic import BaseModel, ValidationError

from app.core.errors import ContentValidationError
from app.prompts.diagnostic import (
    PROMPT_VERSION,
    build_repair_prompt,
    repair_errors_from_exception,
)
from app.providers.base import LLMProvider, LLMRequest, ProviderResult
from app.schemas.common import ProviderMetadata

T = TypeVar("T", bound=BaseModel)


def pydantic_error_list(exc: ValidationError) -> list[str]:
    errors: list[str] = []
    for error in exc.errors()[:25]:
        location = ".".join(str(part) for part in error.get("loc", ()))
        errors.append(f"{location or 'root'}: {error.get('msg', 'invalid value')}")
    return errors


def build_metadata(result: ProviderResult, *, repaired: bool, prompt_version: str = PROMPT_VERSION) -> ProviderMetadata:
    return ProviderMetadata(
        provider=result.provider,
        model=result.model,
        generated_at=datetime.now(timezone.utc).isoformat(),
        prompt_version=prompt_version,
        duration_ms=result.duration_ms,
        repaired=repaired,
        fallback_used=result.fallback_used,
        fallback_reason=result.fallback_reason,
    )


async def generate_validated(
    *,
    provider: LLMProvider,
    task: str,
    schema_name: str,
    schema: dict[str, Any],
    system_prompt: str,
    user_prompt: str,
    payload: dict[str, Any],
    settings: Any,
    parse: Callable[[dict[str, Any]], T],
    validate: Callable[[T], None],
) -> tuple[T, ProviderResult, bool]:
    """Call the provider, validate, and allow exactly one repair attempt.

    The repair attempt is a new model call with the validation errors appended. If it
    still fails, the request fails with a safe 422; nothing invalid is persisted.
    """

    request = LLMRequest(
        task=task,
        schema_name=schema_name,
        schema=schema,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        payload=payload,
        max_output_tokens=settings.llm_max_output_tokens,
        max_output_bytes=settings.llm_max_output_bytes,
        temperature=settings.llm_temperature,
        timeout_seconds=settings.llm_timeout_seconds,
    )
    result = await provider.generate_json(request)
    try:
        parsed = parse(result.data)
        validate(parsed)
        return parsed, result, False
    except ValidationError as exc:
        errors = pydantic_error_list(exc)
    except ContentValidationError as exc:
        errors = repair_errors_from_exception(exc)

    repair_prompt = build_repair_prompt(user_prompt, errors)
    repair_request = replace(request, user_prompt=repair_prompt)
    repaired_result = await provider.generate_json(repair_request)
    try:
        parsed = parse(repaired_result.data)
        validate(parsed)
        return parsed, repaired_result, True
    except ValidationError as exc:
        final_errors = pydantic_error_list(exc)
    except ContentValidationError as exc:
        final_errors = repair_errors_from_exception(exc)

    raise ContentValidationError(
        "The generated content is structurally invalid, even after one repair attempt.",
        details={"errors": final_errors[:30]},
    )


def describe_error(exc: Exception) -> str:
    if isinstance(exc, ContentValidationError):
        return exc.safe_message
    return type(exc).__name__
