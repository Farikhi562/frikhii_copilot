from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class LLMRequest:
    task: str
    schema_name: str
    schema: dict[str, Any]
    system_prompt: str
    user_prompt: str
    payload: dict[str, Any]
    max_output_tokens: int
    max_output_bytes: int
    temperature: float
    timeout_seconds: float


@dataclass
class ProviderResult:
    data: dict[str, Any]
    provider: str
    model: str
    duration_ms: int
    usage: dict[str, Any] = field(default_factory=dict)
    fallback_used: bool = False
    fallback_reason: str | None = None


class LLMProvider(Protocol):
    name: str
    model: str

    async def generate_json(self, request: LLMRequest) -> ProviderResult: ...


_JSON_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


def extract_json_object(raw: str, *, max_bytes: int) -> dict[str, Any]:
    """Extract one JSON object from a provider response without trusting the wrapper."""

    if len(raw.encode("utf-8")) > max_bytes:
        from app.core.errors import LLMResponseError

        raise LLMResponseError("The provider response exceeded the size limit.")

    text = raw.strip()
    fence = _JSON_FENCE.search(text)
    if fence:
        text = fence.group(1).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        from app.core.errors import LLMResponseError

        raise LLMResponseError("The provider did not return a JSON object.")
    candidate = text[start : end + 1]
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        from app.core.errors import LLMResponseError

        raise LLMResponseError(f"The provider returned invalid JSON (line {exc.lineno}).") from exc
    if not isinstance(parsed, dict):
        from app.core.errors import LLMResponseError

        raise LLMResponseError("The provider returned JSON that is not an object.")
    return parsed
