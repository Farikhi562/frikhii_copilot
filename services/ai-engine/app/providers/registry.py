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
from app.providers.base import (
    ChatRequest,
    ChatResult,
    LLMProvider,
    LLMRequest,
    ProviderResult,
)
from app.providers.gemini import GeminiProvider
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

    async def generate_chat(self, request: ChatRequest) -> ChatResult:
        try:
            return await self.primary.generate_chat(request)
        except _ERRORS as exc:
            if self.fallback is None:
                raise
            logger.warning(
                "Primary LLM chat failed; using configured fallback provider=%s error=%s",
                self.primary.name,
                type(exc).__name__,
            )
            result = await self.fallback.generate_chat(request)
            result.fallback_used = True
            result.fallback_reason = type(exc).__name__
            return result


def _build_provider_instance(name: str, settings: Settings, is_fallback: bool = False) -> LLMProvider:
    provider_name = name.strip().lower()
    if provider_name == "gemini":
        model = settings.gemini_model.strip() or "gemini-2.5-flash"
        api_key = settings.effective_api_key
        # If API key is not present in development, handle gracefully or raise
        return GeminiProvider(
            model=model,
            api_key=api_key,
            settings=settings,
        )
    elif provider_name == "mock":
        return MockProvider()
    elif provider_name == "openai-compatible":
        if is_fallback:
            return OpenAICompatibleProvider(
                name="openai-compatible-fallback",
                model=settings.llm_fallback_model,
                api_key=settings.llm_fallback_api_key,
                base_url=settings.llm_fallback_base_url,
                settings=settings,
            )
        return OpenAICompatibleProvider(
            name="openai-compatible",
            model=settings.llm_model,
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            settings=settings,
        )
    else:
        raise LLMConfigurationError(f"Unsupported LLM provider: {provider_name}")


def build_provider(settings: Settings) -> LLMProvider:
    provider_name = settings.effective_provider
    try:
        primary = _build_provider_instance(provider_name, settings, is_fallback=False)
    except LLMConfigurationError:
        if settings.app_env in ("development", "test") and not settings.effective_api_key:
            logger.warning("No API key configured for %s in %s environment. Falling back to MockProvider for offline dev.", provider_name, settings.app_env)
            primary = MockProvider()
        else:
            raise

    fallback: LLMProvider | None = None
    if settings.fallback_configured:
        fallback_name = settings.llm_fallback_provider.strip().lower()
        fallback = _build_provider_instance(fallback_name, settings, is_fallback=True)

    return ProviderChain(primary, fallback)


@lru_cache
def get_provider() -> LLMProvider:
    return build_provider(get_settings())
