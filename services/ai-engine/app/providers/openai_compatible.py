from __future__ import annotations

import asyncio
import logging
import random
import time
from typing import Any

import httpx

from app.core.config import Settings
from app.core.errors import (
    LLMConfigurationError,
    LLMRateLimitError,
    LLMResponseError,
    LLMTimeoutError,
    LLMUnavailableError,
)
from app.providers.base import (
    ChatRequest,
    ChatResult,
    LLMProvider,
    LLMRequest,
    ProviderResult,
    extract_json_object,
)

logger = logging.getLogger(__name__)


class OpenAICompatibleProvider(LLMProvider):
    """Adapter for the widely supported Chat Completions JSON interface.

    This works with OpenAI and compatible gateways (OpenRouter, Groq, Together,
    Google's OpenAI-compatible endpoint, vLLM, Ollama, etc.). Provider-specific
    differences stay in configuration; no provider SDK leaks into services.
    """

    def __init__(
        self,
        *,
        name: str,
        model: str,
        api_key: str,
        base_url: str,
        settings: Settings,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not model or not api_key or not base_url:
            raise LLMConfigurationError("Provider model, API key and base URL are required.")
        self.name = name
        self.model = model
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._settings = settings
        self._transport = transport

    def _endpoint(self) -> str:
        if self._base_url.endswith("/chat/completions"):
            return self._base_url
        return f"{self._base_url}/chat/completions"

    def _response_format(self, request: LLMRequest) -> dict[str, Any]:
        if self._settings.llm_structured_output == "json_schema":
            return {
                "type": "json_schema",
                "json_schema": {
                    "name": request.schema_name,
                    "schema": request.schema,
                    "strict": False,
                },
            }
        return {"type": "json_object"}

    async def generate_json(self, request: LLMRequest) -> ProviderResult:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_prompt},
            ],
            "temperature": request.temperature,
            "max_tokens": request.max_output_tokens,
            "response_format": self._response_format(request),
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        timeout = httpx.Timeout(request.timeout_seconds, connect=10.0)
        attempts = self._settings.llm_max_retries + 1
        last_error: Exception | None = None

        for attempt in range(attempts):
            started = time.perf_counter()
            try:
                async with httpx.AsyncClient(
                    timeout=timeout, transport=self._transport
                ) as client:
                    response = await client.post(self._endpoint(), json=payload, headers=headers)
            except httpx.TimeoutException as exc:
                last_error = exc
                if attempt + 1 < attempts:
                    await self._sleep(attempt)
                    continue
                raise LLMTimeoutError() from exc
            except httpx.HTTPError as exc:
                last_error = exc
                if attempt + 1 < attempts:
                    await self._sleep(attempt)
                    continue
                raise LLMUnavailableError("The provider could not be reached.") from exc

            duration_ms = int((time.perf_counter() - started) * 1000)
            if response.status_code == 429:
                retry_after = self._retry_after(response, attempt)
                if attempt + 1 < attempts:
                    await asyncio.sleep(retry_after)
                    continue
                raise LLMRateLimitError(details={"retry_after_seconds": round(retry_after, 1)})
            if response.status_code in {500, 502, 503, 504}:
                if attempt + 1 < attempts:
                    await self._sleep(attempt)
                    continue
                raise LLMUnavailableError()
            if response.status_code >= 400:
                # Never include the provider body: it can contain echoes of prompts.
                logger.warning(
                    "LLM request rejected provider=%s status=%s task=%s",
                    self.name,
                    response.status_code,
                    request.task,
                )
                raise LLMResponseError(
                    f"The provider rejected the request (HTTP {response.status_code})."
                )

            try:
                body = response.json()
                content = body["choices"][0]["message"]["content"]
                if not isinstance(content, str):
                    raise TypeError("content is not a string")
            except (ValueError, KeyError, IndexError, TypeError) as exc:
                raise LLMResponseError("The provider response had an unexpected shape.") from exc

            data = extract_json_object(content, max_bytes=request.max_output_bytes)
            usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}
            return ProviderResult(
                data=data,
                provider=self.name,
                model=self.model,
                duration_ms=duration_ms,
                usage={
                    "prompt_tokens": usage.get("prompt_tokens"),
                    "completion_tokens": usage.get("completion_tokens"),
                    "total_tokens": usage.get("total_tokens"),
                },
            )

        raise LLMUnavailableError() from last_error

    async def generate_chat(self, request: ChatRequest) -> ChatResult:
        messages = [{"role": "system", "content": request.system_instruction}]
        for m in request.messages:
            messages.append({"role": m.role, "content": m.content})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": request.max_output_tokens,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        started = time.perf_counter()
        async with httpx.AsyncClient(timeout=request.timeout_seconds, transport=self._transport) as client:
            resp = await client.post(f"{self._base_url}/chat/completions", headers=headers, json=payload)
            duration_ms = int((time.perf_counter() - started) * 1000)
            if resp.status_code != 200:
                raise LLMResponseError(f"Provider rejected chat request (HTTP {resp.status_code}).")
            body = resp.json()
            choice = body["choices"][0]
            text = choice["message"]["content"]
            usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}
            return ChatResult(
                text=text,
                provider=self.name,
                model=self.model,
                duration_ms=duration_ms,
                usage=usage,
                finish_reason=choice.get("finish_reason"),
            )

    async def _sleep(self, attempt: int) -> None:
        base = min(8.0, 0.8 * (2**attempt))
        await asyncio.sleep(base + random.uniform(0, 0.25))

    @staticmethod
    def _retry_after(response: httpx.Response, attempt: int) -> float:
        header = response.headers.get("retry-after")
        if header:
            try:
                return max(0.5, min(30.0, float(header)))
            except ValueError:
                pass
        return min(8.0, 1.0 * (2**attempt))
