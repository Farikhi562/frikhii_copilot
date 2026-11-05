from __future__ import annotations

import asyncio

import pytest

from app.core.config import Settings
from app.core.errors import ContentValidationError
from app.providers.base import LLMRequest
from app.providers.mock import MockProvider
from app.schemas.curriculum import CourseBlueprint, CurriculumGenerateRequest
from app.validators.curriculum import validate_curriculum
from app.validators.diagnostic import validate_question_set


def _settings() -> Settings:
    return Settings(
        _env_file=None,
        app_env="test",
        internal_service_token="test",
        llm_provider="mock",
        rate_limit_per_minute=600,
    )


def _mock_course(payload: dict) -> CourseBlueprint:
    request = LLMRequest(
        task="curriculum_generate",
        schema_name="course_blueprint",
        schema={},
        system_prompt="",
        user_prompt="",
        payload=payload,
        max_output_tokens=1000,
        max_output_bytes=500_000,
        temperature=0.2,
        timeout_seconds=10,
    )
    provider = MockProvider()
    result = asyncio.run(provider.generate_json(request))
    return CourseBlueprint.model_validate(result.data)


def test_mock_course_passes_validation(goal_payload, diagnostic_payload):
    request = CurriculumGenerateRequest(learning_goal=goal_payload, diagnostic=diagnostic_payload)
    course = _mock_course(request.model_dump(mode="json"))
    warnings = validate_curriculum(course, request)
    assert isinstance(warnings, list)


def test_duplicate_ids_are_rejected(goal_payload, diagnostic_payload):
    request = CurriculumGenerateRequest(learning_goal=goal_payload, diagnostic=diagnostic_payload)
    course = _mock_course(request.model_dump(mode="json"))
    course.modules[1].classes[0].id = course.modules[0].classes[0].id
    with pytest.raises(ContentValidationError) as exc:
        validate_curriculum(course, request)
    assert any("Duplicate id" in item for item in exc.value.details["errors"])


def test_later_class_prerequisite_is_rejected(goal_payload, diagnostic_payload):
    request = CurriculumGenerateRequest(learning_goal=goal_payload, diagnostic=diagnostic_payload)
    course = _mock_course(request.model_dump(mode="json"))
    course.modules[0].classes[0].prerequisite_class_ids = [course.modules[-1].classes[-1].id]
    with pytest.raises(ContentValidationError) as exc:
        validate_curriculum(course, request)
    assert any("not earlier" in item for item in exc.value.details["errors"])


def test_module_cycle_is_rejected(goal_payload, diagnostic_payload):
    request = CurriculumGenerateRequest(learning_goal=goal_payload, diagnostic=diagnostic_payload)
    course = _mock_course(request.model_dump(mode="json"))
    course.modules[0].required_previous_module_ids = [course.modules[2].id]
    course.modules[2].required_previous_module_ids = [course.modules[0].id]
    with pytest.raises(ContentValidationError) as exc:
        validate_curriculum(course, request)
    assert any("cycle" in item.lower() or "not earlier" in item for item in exc.value.details["errors"])


def test_urls_are_rejected(goal_payload, diagnostic_payload):
    request = CurriculumGenerateRequest(learning_goal=goal_payload, diagnostic=diagnostic_payload)
    course = _mock_course(request.model_dump(mode="json"))
    course.description += " Read more at https://invented.example/source"
    with pytest.raises(ContentValidationError) as exc:
        validate_curriculum(course, request)
    assert any("URL" in item for item in exc.value.details["errors"])


def test_diagnostic_duplicate_ids_and_bad_key_are_rejected(goal_payload):
    from app.schemas.diagnostic import DiagnosticGenerateRequest
    from app.services.diagnostic_service import generate_diagnostic

    generated = asyncio.run(
        generate_diagnostic(
            DiagnosticGenerateRequest(learning_goal=goal_payload),
            provider=MockProvider(),
            settings=_settings(),
        )
    )
    question_set = generated.question_set.model_copy(deep=True)
    question_set.questions[1].id = question_set.questions[0].id
    keys = [key.model_dump() for key in generated.answer_keys]
    with pytest.raises(ContentValidationError):
        validate_question_set(question_set, keys)
