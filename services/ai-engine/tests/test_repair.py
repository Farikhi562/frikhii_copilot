from __future__ import annotations

import asyncio

import pytest

from app.core.config import Settings
from app.core.errors import ContentValidationError
from app.providers.base import LLMRequest, ProviderResult
from app.providers.mock import MockProvider
from app.schemas.curriculum import CurriculumGenerateRequest


class SequenceProvider:
    name = "sequence"
    model = "sequence-v1"

    def __init__(self, responses: list[dict]) -> None:
        self.responses = list(responses)
        self.calls = 0

    async def generate_json(self, request: LLMRequest) -> ProviderResult:
        self.calls += 1
        data = self.responses.pop(0)
        return ProviderResult(data=data, provider=self.name, model=self.model, duration_ms=1)


def settings() -> Settings:
    return Settings(
        _env_file=None,
        app_env="test",
        internal_service_token="test",
        llm_provider="mock",
        rate_limit_per_minute=600,
    )


def valid_course_payload(goal_payload, diagnostic_payload) -> dict:
    request = CurriculumGenerateRequest(learning_goal=goal_payload, diagnostic=diagnostic_payload)
    llm_request = LLMRequest(
        task="curriculum_generate",
        schema_name="course_blueprint",
        schema={},
        system_prompt="",
        user_prompt="",
        payload=request.model_dump(mode="json"),
        max_output_tokens=1000,
        max_output_bytes=500_000,
        temperature=0.2,
        timeout_seconds=10,
    )
    return asyncio.run(MockProvider().generate_json(llm_request)).data


def test_one_repair_attempt_recovers_invalid_json(goal_payload, diagnostic_payload):
    from app.services.curriculum_service import generate_curriculum

    valid = valid_course_payload(goal_payload, diagnostic_payload)
    provider = SequenceProvider([{}, valid])
    request = CurriculumGenerateRequest(learning_goal=goal_payload, diagnostic=diagnostic_payload)
    result = asyncio.run(generate_curriculum(request, provider=provider, settings=settings()))
    assert provider.calls == 2
    assert result.metadata.repaired is True


def test_repair_failure_is_rejected(goal_payload, diagnostic_payload):
    from app.services.curriculum_service import generate_curriculum

    provider = SequenceProvider([{}, {}])
    request = CurriculumGenerateRequest(learning_goal=goal_payload, diagnostic=diagnostic_payload)
    with pytest.raises(ContentValidationError) as exc:
        asyncio.run(generate_curriculum(request, provider=provider, settings=settings()))
    assert provider.calls == 2
    assert "structurally invalid" in str(exc.value)
