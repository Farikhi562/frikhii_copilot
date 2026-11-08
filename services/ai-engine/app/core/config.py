from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment configuration for the AI Engine.

    Secrets are read only from the process environment / local .env file. They are
    never included in responses or logs.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: Literal["development", "test", "production"] = "development"
    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "info"

    internal_service_token: str = ""
    rate_limit_per_minute: int = Field(default=30, ge=1, le=600)
    max_request_bytes: int = Field(default=262_144, ge=16_384, le=2_000_000)

    # Provider selection: "gemini", "openai-compatible", or "mock"
    ai_provider: str = ""
    llm_provider: str = "gemini"

    # Gemini configuration
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Common AI configuration
    ai_max_output_tokens: int = Field(default=8000, ge=512, le=32000)
    ai_max_output_bytes: int = Field(default=524_288, ge=32_768, le=2_000_000)
    ai_temperature: float = Field(default=0.2, ge=0, le=1.5)
    ai_request_timeout: float = Field(default=120, ge=5, le=300)
    ai_max_retries: int = Field(default=2, ge=0, le=4)

    # OpenAI-compatible fallback / alternative
    llm_model: str = ""
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_structured_output: Literal["json_schema", "json_object"] = "json_object"
    llm_timeout_seconds: float = Field(default=120, ge=5, le=300)
    llm_max_retries: int = Field(default=2, ge=0, le=4)
    llm_max_output_tokens: int = Field(default=8000, ge=512, le=32000)
    llm_max_output_bytes: int = Field(default=524_288, ge=32_768, le=2_000_000)
    llm_temperature: float = Field(default=0.2, ge=0, le=1.5)

    llm_fallback_provider: str = ""
    llm_fallback_model: str = ""
    llm_fallback_api_key: str = ""
    llm_fallback_base_url: str = ""

    @property
    def effective_provider(self) -> str:
        prov = self.ai_provider.strip().lower() if self.ai_provider else self.llm_provider.strip().lower()
        return prov or "gemini"

    @property
    def effective_model(self) -> str:
        if self.effective_provider == "gemini":
            return self.gemini_model.strip() or self.llm_model.strip() or "gemini-2.5-flash"
        return self.llm_model.strip()

    @property
    def effective_api_key(self) -> str:
        if self.effective_provider == "gemini":
            return self.gemini_api_key.strip() or self.llm_api_key.strip()
        return self.llm_api_key.strip()

    @property
    def effective_temperature(self) -> float:
        return self.ai_temperature if self.ai_temperature is not None else self.llm_temperature

    @property
    def effective_timeout(self) -> float:
        return self.ai_request_timeout if self.ai_request_timeout is not None else self.llm_timeout_seconds

    @property
    def effective_max_retries(self) -> int:
        return self.ai_max_retries if self.ai_max_retries is not None else self.llm_max_retries

    @property
    def effective_max_output_tokens(self) -> int:
        return self.ai_max_output_tokens if self.ai_max_output_tokens is not None else self.llm_max_output_tokens

    @property
    def effective_max_output_bytes(self) -> int:
        return self.ai_max_output_bytes if self.ai_max_output_bytes is not None else self.llm_max_output_bytes

    @property
    def uses_mock_provider(self) -> bool:
        return self.effective_provider == "mock"

    @property
    def fallback_configured(self) -> bool:
        return bool(self.llm_fallback_provider.strip())

    @model_validator(mode="after")
    def validate_provider(self) -> "Settings":
        provider = self.effective_provider
        if provider not in {"gemini", "openai-compatible", "mock"}:
            raise ValueError("AI_PROVIDER / LLM_PROVIDER must be 'gemini', 'openai-compatible', or 'mock'.")
        if provider == "mock" and self.app_env == "production":
            raise ValueError("LLM_PROVIDER=mock is not allowed when APP_ENV=production.")
        if provider == "gemini" and self.app_env != "test":
            key = self.gemini_api_key.strip() or self.llm_api_key.strip()
            if not key:
                # In development without GEMINI_API_KEY, raise informative message
                # or allow fallback if configured
                pass
        if provider == "openai-compatible" and self.app_env != "test":
            missing = [
                name
                for name, value in (
                    ("LLM_MODEL", self.llm_model),
                    ("LLM_API_KEY", self.llm_api_key),
                    ("LLM_BASE_URL", self.llm_base_url),
                )
                if not value.strip()
            ]
            if missing:
                raise ValueError(
                    "Missing LLM configuration: " + ", ".join(missing) + ". "
                    "Set them or use AI_PROVIDER=mock for offline development."
                )
        if self.app_env != "test" and not self.internal_service_token.strip():
            raise ValueError(
                "INTERNAL_SERVICE_TOKEN is required. The internal endpoints must never be public."
            )
        if self.fallback_configured:
            fallback = self.llm_fallback_provider.strip().lower()
            if fallback not in {"gemini", "mock", "openai-compatible"}:
                raise ValueError("LLM_FALLBACK_PROVIDER must be 'gemini', 'openai-compatible', or 'mock'.")
            if fallback == "mock" and self.app_env == "production":
                raise ValueError("A mock fallback provider is not allowed when APP_ENV=production.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
