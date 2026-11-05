from __future__ import annotations

import asyncio

import pytest

from app.core.config import Settings
from app.core.errors import ContentValidationError
from app.providers.mock import MockProvider
from app.schemas.curriculum import CurriculumGenerateRequest
from app.schemas.diagnostic import DiagnosticGenerateRequest
from app.services.curriculum_service import generate_curriculum
from app.services.diagnostic_service import evaluate_diagnostic, generate_diagnostic


def settings() -> Settings:
    return Settings(
        _env_file=None,
        app_env="test",
        internal_service_token="test-token",
        llm_provider="mock",
        rate_limit_per_minute=600,
    )


def test_diagnostic_generation_and_evaluation(goal_payload):
    provider = MockProvider()
    request = DiagnosticGenerateRequest(learning_goal=goal_payload)
    generated = asyncio.run(generate_diagnostic(request, provider=provider, settings=settings()))

    assert 5 <= len(generated.question_set.questions) <= 8
    assert len(generated.answer_keys) == len(generated.question_set.questions)
    assert generated.metadata.provider == "mock"
    question_ids = {q.id for q in generated.question_set.questions}
    assert {k.question_id for k in generated.answer_keys} == question_ids

    answers = []
    for question in generated.question_set.questions:
        if question.type.value == "multiple_choice":
            choice = question.choices[0].id
            answers.append({"question_id": question.id, "response": choice})
        else:
            answers.append(
                {
                    "question_id": question.id,
                    "response": "I would reproduce the problem, isolate it, form a hypothesis and test one change at a time with evidence.",
                }
            )

    from app.schemas.diagnostic import DiagnosticEvaluateRequest

    evaluation_request = DiagnosticEvaluateRequest(
        learning_goal=goal_payload,
        questions=generated.question_set.questions,
        answer_keys=generated.answer_keys,
        answers=answers,
    )
    evaluated = asyncio.run(
        evaluate_diagnostic(evaluation_request, provider=provider, settings=settings())
    )
    assert evaluated.evaluation.estimated_level.value in {
        "foundation",
        "beginner",
        "intermediate",
        "advanced",
    }
    assert len(evaluated.evaluation.question_scores) == len(generated.question_set.questions)


def test_curriculum_generation_is_valid_and_relational(goal_payload, diagnostic_payload):
    provider = MockProvider()
    request = CurriculumGenerateRequest(
        learning_goal=goal_payload, diagnostic=diagnostic_payload
    )
    result = asyncio.run(generate_curriculum(request, provider=provider, settings=settings()))
    course = result.course

    assert course.title
    assert len(course.modules) >= 2
    assert course.objectives
    assert course.final_project.title

    module_ids = {module.id for module in course.modules}
    class_ids = set()
    lesson_ids = set()
    for module in course.modules:
        assert module.classes
        assert set(module.required_previous_module_ids) <= module_ids
        for klass in module.classes:
            assert klass.lessons
            assert klass.exercise.evaluation_criteria
            class_ids.add(klass.id)
            for lesson in klass.lessons:
                lesson_ids.add(lesson.id)
                assert lesson.blueprint.guided_practice

    assert len(class_ids) == sum(len(module.classes) for module in course.modules)
    assert len(class_ids | module_ids | lesson_ids) == len(module_ids) + len(class_ids) + len(lesson_ids)
    assert result.metadata.provider == "mock"
    assert result.metadata.prompt_version.startswith("phase03")


def test_diagnostic_evaluation_rejects_duplicate_answers(goal_payload):
    provider = MockProvider()
    generated = asyncio.run(
        generate_diagnostic(
            DiagnosticGenerateRequest(learning_goal=goal_payload),
            provider=provider,
            settings=settings(),
        )
    )
    answers = [
        {
            "question_id": generated.question_set.questions[0].id,
            "response": "duplicated",
        }
        for _ in range(len(generated.question_set.questions))
    ]

    from app.schemas.diagnostic import DiagnosticEvaluateRequest

    request = DiagnosticEvaluateRequest(
        learning_goal=goal_payload,
        questions=generated.question_set.questions,
        answer_keys=generated.answer_keys,
        answers=answers,
    )
    with pytest.raises(ContentValidationError):
        asyncio.run(evaluate_diagnostic(request, provider=provider, settings=settings()))
