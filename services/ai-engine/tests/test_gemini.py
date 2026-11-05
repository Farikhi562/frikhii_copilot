from __future__ import annotations

import asyncio
from unittest.mock import MagicMock, patch
import pytest

from app.core.config import Settings
from app.core.errors import (
    LLMConfigurationError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMUnavailableError,
)
from app.prompts.tutor import build_tutor_system_instruction, MODE_INSTRUCTIONS
from app.providers.base import ChatRequest, ChatTurn, LLMRequest
from app.providers.gemini import GeminiProvider
from app.schemas.chat import ChatMessage, ChatRequestPayload
from app.services.chat_service import chat_completion


def test_tutor_modes_prompts():
    modes = ["explain", "deep_dive", "practice", "socratic", "review", "project"]
    for mode in modes:
        inst = build_tutor_system_instruction(
            mode,
            context={
                "course_title": "AI Engineering",
                "lesson_title": "Tool Calling Agents",
                "lesson_objectives": ["Understand tools", "Build tool dispatcher"],
                "user_level": "intermediate",
            },
        )
        mode_label = mode.replace("_", " ").upper()
        assert mode_label in inst
        assert "AI Engineering" in inst
        assert "Tool Calling Agents" in inst
        assert "UNDERSTAND" in inst


def test_gemini_missing_api_key():
    settings = Settings(app_env="test")
    with pytest.raises(LLMConfigurationError, match="GEMINI_API_KEY is not configured"):
        GeminiProvider(model="gemini-2.5-flash", api_key="", settings=settings)


def test_gemini_generate_chat_success():
    async def _run():
        settings = Settings(app_env="test")
        provider = GeminiProvider(model="gemini-2.5-flash", api_key="fake-test-key", settings=settings)

        mock_response = MagicMock()
        mock_response.text = "Hello! I am your FRIKHII AI Tutor. Let us begin."
        mock_response.usage_metadata.prompt_token_count = 25
        mock_response.usage_metadata.candidates_token_count = 15
        mock_response.usage_metadata.total_token_count = 40
        candidate = MagicMock()
        candidate.finish_reason = "STOP"
        mock_response.candidates = [candidate]

        with patch.object(provider._client.models, "generate_content", return_value=mock_response):
            req = ChatRequest(
                system_instruction="You are a tutor",
                messages=[ChatTurn(role="user", content="Explain recursion")],
                temperature=0.2,
                max_output_tokens=1000,
                timeout_seconds=30.0,
            )
            result = await provider.generate_chat(req)

            assert result.text == "Hello! I am your FRIKHII AI Tutor. Let us begin."
            assert result.model == "gemini-2.5-flash"
            assert result.provider == "gemini"
            assert result.usage.get("input_tokens") == 25
            assert result.usage.get("output_tokens") == 15
            assert result.finish_reason == "STOP"

    asyncio.run(_run())


def test_gemini_generate_json_success():
    async def _run():
        settings = Settings(app_env="test")
        provider = GeminiProvider(model="gemini-2.5-flash", api_key="fake-test-key", settings=settings)

        mock_response = MagicMock()
        mock_response.text = '{"estimated_level": "intermediate", "summary": "Great progress"}'
        mock_response.usage_metadata.prompt_token_count = 45
        mock_response.usage_metadata.candidates_token_count = 20
        mock_response.usage_metadata.total_token_count = 65

        with patch.object(provider._client.models, "generate_content", return_value=mock_response):
            req = LLMRequest(
                task="diagnostic_evaluate",
                schema_name="diagnostic_evaluation",
                schema={},
                system_prompt="system",
                user_prompt="user",
                payload={"answers": []},
                max_output_tokens=1000,
                max_output_bytes=50000,
                temperature=0.2,
                timeout_seconds=30.0,
            )
            result = await provider.generate_json(req)

            assert result.data["estimated_level"] == "intermediate"
            assert result.provider == "gemini"
            assert result.usage.get("input_tokens") == 45

    asyncio.run(_run())


def test_gemini_rate_limit_error_mapping():
    async def _run():
        settings = Settings(app_env="test")
        provider = GeminiProvider(model="gemini-2.5-flash", api_key="fake-test-key", settings=settings)

        with patch.object(
            provider._client.models,
            "generate_content",
            side_effect=Exception("429 Resource has been exhausted (e.g. check quota)"),
        ):
            req = ChatRequest(
                system_instruction="system",
                messages=[ChatTurn(role="user", content="hi")],
                temperature=0.2,
                max_output_tokens=500,
                timeout_seconds=30.0,
            )
            with pytest.raises(LLMRateLimitError):
                await provider.generate_chat(req)

    asyncio.run(_run())


def test_chat_service_all_modes():
    async def _run():
        settings = Settings(app_env="test")
        provider = GeminiProvider(model="gemini-2.5-flash", api_key="fake-test-key", settings=settings)

        mock_response = MagicMock()
        mock_response.text = "Paham. Mari kita pecah konsepnya."
        mock_response.usage_metadata.prompt_token_count = 20
        mock_response.usage_metadata.candidates_token_count = 10
        mock_response.candidates = [MagicMock(finish_reason="STOP")]

        with patch.object(provider._client.models, "generate_content", return_value=mock_response):
            for mode in ["explain", "deep_dive", "practice", "socratic", "review", "project"]:
                payload = ChatRequestPayload(
                    mode=mode,
                    messages=[ChatMessage(role="user", content=f"Tes mode {mode}")],
                )
                res = await chat_completion(payload, provider=provider, settings=settings)
                assert res.success is True
                assert res.data is not None
                assert res.data.tutor_mode == mode
                assert res.data.text == "Paham. Mari kita pecah konsepnya."

    asyncio.run(_run())
