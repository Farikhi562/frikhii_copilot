from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

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


class GeminiProvider(LLMProvider):
    """Google Gemini LLM provider using the official google-genai SDK."""

    def __init__(
        self,
        *,
        model: str,
        api_key: str,
        settings: Settings,
    ) -> None:
        if not api_key.strip():
            raise LLMConfigurationError(
                "GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your environment or services/ai-engine/.env."
            )
        self.name = "gemini"
        self.model = model.strip() or "gemini-2.5-flash"
        self._api_key = api_key.strip()
        self.settings = settings

        try:
            from google import genai

            self._client = genai.Client(api_key=self._api_key)
        except Exception as exc:
            raise LLMConfigurationError(f"Failed to initialize Gemini client: {exc}") from exc

    def _extract_usage(self, response: Any) -> dict[str, int]:
        usage: dict[str, int] = {}
        metadata = getattr(response, "usage_metadata", None)
        if metadata:
            prompt_tokens = getattr(metadata, "prompt_token_count", None)
            candidates_tokens = getattr(metadata, "candidates_token_count", None)
            total_tokens = getattr(metadata, "total_token_count", None)
            if prompt_tokens is not None:
                usage["input_tokens"] = prompt_tokens
            if candidates_tokens is not None:
                usage["output_tokens"] = candidates_tokens
            if total_tokens is not None:
                usage["total_tokens"] = total_tokens
        return usage

    def _map_gemini_error(self, exc: Exception) -> Exception:
        err_msg = str(exc)
        lower_msg = err_msg.lower()

        if "api_key" in lower_msg or "invalid api key" in lower_msg or "permission denied" in lower_msg:
            return LLMConfigurationError(f"Gemini authentication failed: {err_msg}")
        if "quota" in lower_msg or "resource_exhausted" in lower_msg or "429" in lower_msg or "rate limit" in lower_msg:
            return LLMRateLimitError("Gemini rate limit or quota exceeded. Please try again shortly.")
        if "deadline" in lower_msg or "timeout" in lower_msg:
            return LLMTimeoutError("Gemini request timed out.")
        if "not found" in lower_msg or "model" in lower_msg and "unavailable" in lower_msg:
            return LLMUnavailableError(f"The requested Gemini model '{self.model}' is unavailable.")
        return LLMUnavailableError(f"Gemini API request failed: {err_msg}")

    async def generate_json(self, request: LLMRequest) -> ProviderResult:
        from google.genai import types

        prompt_text = (
            f"{request.user_prompt}\n\n"
            f"Input payload:\n{json.dumps(request.payload, indent=2)}\n\n"
            f"You MUST respond ONLY with a valid JSON object matching the required schema: {request.schema_name}."
        )

        config = types.GenerateContentConfig(
            system_instruction=request.system_prompt,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
            response_mime_type="application/json",
        )

        started = time.monotonic()
        timeout = request.timeout_seconds or self.settings.effective_timeout

        try:
            # google-genai async or sync via run_in_executor
            loop = asyncio.get_running_loop()
            response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: self._client.models.generate_content(
                        model=self.model,
                        contents=prompt_text,
                        config=config,
                    ),
                ),
                timeout=timeout,
            )
        except asyncio.TimeoutError as exc:
            raise LLMTimeoutError(f"Gemini request timed out after {timeout} seconds.") from exc
        except Exception as exc:
            raise self._map_gemini_error(exc) from exc

        duration_ms = int((time.monotonic() - started) * 1000)
        raw_text = response.text or ""
        if not raw_text.strip():
            raise LLMResponseError("Gemini returned an empty response.")

        parsed_data = extract_json_object(raw_text, max_bytes=request.max_output_bytes)
        usage = self._extract_usage(response)

        return ProviderResult(
            data=parsed_data,
            provider=self.name,
            model=self.model,
            duration_ms=duration_ms,
            usage=usage,
        )

    async def generate_chat(self, request: ChatRequest) -> ChatResult:
        from google.genai import types

        contents: list[types.Content] = []
        for msg in request.messages:
            role = "user" if msg.role == "user" else "model"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.content)],
                )
            )

        config = types.GenerateContentConfig(
            system_instruction=request.system_instruction,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
        )

        started = time.monotonic()
        timeout = request.timeout_seconds or self.settings.effective_timeout

        try:
            loop = asyncio.get_running_loop()
            response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: self._client.models.generate_content(
                        model=self.model,
                        contents=contents,
                        config=config,
                    ),
                ),
                timeout=timeout,
            )
        except asyncio.TimeoutError as exc:
            raise LLMTimeoutError(f"Gemini chat request timed out after {timeout} seconds.") from exc
        except Exception as exc:
            raise self._map_gemini_error(exc) from exc

        duration_ms = int((time.monotonic() - started) * 1000)
        text = response.text or ""
        if not text.strip():
            raise LLMResponseError("Gemini returned an empty response.")

        usage = self._extract_usage(response)
        finish_reason = None
        if hasattr(response, "candidates") and response.candidates:
            finish_reason = getattr(response.candidates[0], "finish_reason", None)

        return ChatResult(
            text=text,
            provider=self.name,
            model=self.model,
            duration_ms=duration_ms,
            usage=usage,
            finish_reason=str(finish_reason) if finish_reason else None,
        )
