from __future__ import annotations

import logging
from functools import lru_cache

from app.core.config import Settings, get_settings
from app.core.errors import (
    LLMConfigurationError,
    LLMRateLimitError,
    LLMResponseError,
    LLMTimeoutError,
    LLMUnavailableError,
)
from app.providers.base import LLMProvider, LLMRequest, ProviderResult
from app.providers.mock import MockProvider
from app.providers.openai_compatible import OpenAICompatibleProvider

logger = logging.getLogger(__name__)

_ERRORS = (LLMRateLimitError, LLMTimeoutError, LLMUnavailableError, LLMResponseError)


class ProviderChain:
    """Primary provider with an explicitly configured fallback.

    The fallback is never silent: the result records `fallback_used` and the safe reason,
    which the API surfaces in generation metadata.
    """

    def __init__(self, primary: LLMProvider, fallback: LLMProvider | None) -> None:
        self.primary = primary
        self.fallback = fallback

    @property
    def name(self) -> str:
        return self.primary.name

    @property
    def model(self) -> str:
        return self.primary.model

    async def generate_json(self, request: LLMRequest) -> ProviderResult:
        try:
            return await self.primary.generate_json(request)
        except _ERRORS as exc:
            if self.fallback is None:
                raise
            logger.warning(
                "Primary LLM failed; using configured fallback provider=%s error=%s",
                self.primary.name,
                type(exc).__name__,
            )
            result = await self.fallback.generate_json(request)
            result.fallback_used = True
            result.fallback_reason = type(exc).__name__
            return result


def _build_openai_compatible(
    *,
    name: str,
    model: str,
    api_key: str,
    base_url: str,
    settings: Settings,
) -> LLMProvider:
    return OpenAICompatibleProvider(
        name=name,
        model=model,
        api_key=api_key,
        base_url=base_url,
        settings=settings,
    )


def build_provider(settings: Settings) -> LLMProvider:
    provider_name = settings.llm_provider.strip().lower()
    if provider_name == "mock":
        primary: LLMProvider = MockProvider()
    elif provider_name == "openai-compatible":
        primary = _build_openai_compatible(
            name="openai-compatible",
            model=settings.llm_model,
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            settings=settings,
        )
    else:  # pragma: no cover - Settings validates this
        raise LLMConfigurationError(f"Unsupported LLM provider: {provider_name}")

    fallback: LLMProvider | None = None
    if settings.fallback_configured:
        fallback_name = settings.llm_fallback_provider.strip().lower()
        if fallback_name == "mock":
            fallback = MockProvider()
        elif fallback_name == "openai-compatible":
            fallback = _build_openai_compatible(
                name="openai-compatible-fallback",
                model=settings.llm_fallback_model,
                api_key=settings.llm_fallback_api_key,
                base_url=settings.llm_fallback_base_url,
                settings=settings,
            )
    return ProviderChain(primary, fallback)


@lru_cache
def get_provider() -> LLMProvider:
    return build_provider(get_settings())
