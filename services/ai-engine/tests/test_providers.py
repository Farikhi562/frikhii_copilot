from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from app.core.config import Settings
from app.core.errors import LLMResponseError, LLMTimeoutError
from app.providers.base import LLMRequest, extract_json_object
from app.providers.openai_compatible import OpenAICompatibleProvider


def settings(**overrides) -> Settings:
    base = dict(
        _env_file=None,
        app_env="test",
        internal_service_token="test",
        llm_provider="openai-compatible",
        llm_model="test-model",
        llm_api_key="not-a-real-key",
        llm_base_url="https://provider.example/v1",
        llm_max_retries=1,
        llm_timeout_seconds=5,
    )
    base.update(overrides)
    return Settings(**base)


def request() -> LLMRequest:
    return LLMRequest(
        task="diagnostic_generate",
        schema_name="test",
        schema={"type": "object"},
        system_prompt="system",
        user_prompt="user",
        payload={},
        max_output_tokens=1000,
        max_output_bytes=10_000,
        temperature=0.2,
        timeout_seconds=5,
    )


def test_extract_json_from_fence_and_prose():
    assert extract_json_object('```json\n{"a": 1}\n```', max_bytes=1000) == {"a": 1}
    assert extract_json_object('Here is the result: {"a": 2} thanks', max_bytes=1000) == {"a": 2}


def test_extract_rejects_oversize_and_invalid():
    with pytest.raises(LLMResponseError):
        extract_json_object('{"a": 1}', max_bytes=3)
    with pytest.raises(LLMResponseError):
        extract_json_object("not json", max_bytes=1000)


def test_openai_compatible_success():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer not-a-real-key"
        body = json.loads(request.content)
        assert body["model"] == "test-model"
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": '{"ok": true}'}}],
                "usage": {"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3},
            },
        )

    provider = OpenAICompatibleProvider(
        name="openai-compatible",
        model="test-model",
        api_key="not-a-real-key",
        base_url="https://provider.example/v1",
        settings=settings(),
        transport=httpx.MockTransport(handler),
    )
    result = asyncio.run(provider.generate_json(request()))
    assert result.data == {"ok": True}
    assert result.provider == "openai-compatible"
    assert result.usage["total_tokens"] == 3


def test_rate_limit_is_retried_then_succeeds():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, headers={"retry-after": "0"}, json={"error": "slow down"})
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"ok": true}'}}]})

    provider = OpenAICompatibleProvider(
        name="openai-compatible",
        model="test-model",
        api_key="not-a-real-key",
        base_url="https://provider.example/v1",
        settings=settings(),
        transport=httpx.MockTransport(handler),
    )
    assert asyncio.run(provider.generate_json(request())).data == {"ok": True}
    assert calls["n"] == 2


def test_timeout_maps_to_safe_error():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("too slow", request=request)

    provider = OpenAICompatibleProvider(
        name="openai-compatible",
        model="test-model",
        api_key="not-a-real-key",
        base_url="https://provider.example/v1",
        settings=settings(llm_max_retries=0),
        transport=httpx.MockTransport(handler),
    )
    with pytest.raises(LLMTimeoutError):
        asyncio.run(provider.generate_json(request()))


def test_production_rejects_mock_fallback():
    with pytest.raises(ValueError):
        settings(
            app_env="production",
            llm_provider="openai-compatible",
            llm_model="test-model",
            llm_api_key="not-a-real-key",
            llm_base_url="https://provider.example/v1",
            llm_fallback_provider="mock",
        )


def test_provider_rejection_does_not_leak_body():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "secret provider details"})

    provider = OpenAICompatibleProvider(
        name="openai-compatible",
        model="test-model",
        api_key="not-a-real-key",
        base_url="https://provider.example/v1",
        settings=settings(llm_max_retries=0),
        transport=httpx.MockTransport(handler),
    )
    with pytest.raises(LLMResponseError) as exc:
        asyncio.run(provider.generate_json(request()))
    assert "secret provider details" not in str(exc.value)
