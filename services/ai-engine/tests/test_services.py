from __future__ import annotations

import asyncio

import pytest

from app.core.config import Settings
from app.core.errors import ContentValidationError
from app.providers.mock import MockProvider
from app.schemas.curriculum import CurriculumGenerateRequest
from app.schemas.diagnostic import DiagnosticGenerateRequest
from app.schemas.learning import (
    ExerciseGenerateRequest,
    LessonGenerateRequest,
    QuizEvaluateRequest,
    QuizGenerateRequest,
    RemedialGenerateRequest,
)
from app.services.curriculum_service import generate_curriculum
from app.services.diagnostic_service import evaluate_diagnostic, generate_diagnostic
from app.services.learning_service import (
    evaluate_quiz,
    generate_exercise,
    generate_lesson,
    generate_quiz,
    generate_remedial,
)


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


def test_learning_engine_mock_end_to_end():
    provider = MockProvider()
    cfg = settings()

    lesson = asyncio.run(
        generate_lesson(
            LessonGenerateRequest(
                lesson_id="lesson-1",
                title="Variables and state",
                description="Understand how values are stored and changed in a program.",
                blueprint={"summary": "blueprint body"},
                course_title="Python Foundations",
                class_title="State basics",
            ),
            provider=provider,
            settings=cfg,
        )
    )
    assert lesson.lesson.lesson_id == "lesson-1"
    assert len(lesson.lesson.sections) >= 4

    quiz = asyncio.run(
        generate_quiz(
            QuizGenerateRequest(
                class_id="class-1",
                class_title="State basics",
                class_description="Learn how state changes across a program run.",
                competencies=["Applied understanding"],
                knowledge_check_description="Verify the learner can apply state changes unaided.",
                question_count=5,
                course_title="Python Foundations",
            ),
            provider=provider,
            settings=cfg,
        )
    )
    assert len(quiz.questions) == 5
    assert quiz.passing_score == 80

    answers = [
        {
            "question_id": q.id,
            "response": "a"
            if q.type == "multiple_choice"
            else "The value is stored in a variable and reassigned, with a concrete example.",
        }
        for q in quiz.questions
    ]
    evaluation = asyncio.run(
        evaluate_quiz(
            QuizEvaluateRequest(
                class_id="class-1",
                class_title="State basics",
                questions=quiz.questions,
                answer_keys=quiz.answer_keys,
                answers=answers,
                passing_score=quiz.passing_score,
            ),
            provider=provider,
            settings=cfg,
        )
    ).evaluation
    scored = {s.question_id for s in evaluation.question_scores}
    assert scored == {q.id for q in quiz.questions}
    assert evaluation.passed == (evaluation.score >= quiz.passing_score)

    exercise = asyncio.run(
        generate_exercise(
            ExerciseGenerateRequest(
                class_id="class-1",
                class_title="State basics",
                exercise_title="Build a counter",
                exercise_description="Apply state changes by building a small counter.",
                difficulty="foundation",
                competency="Applied understanding",
                course_title="Python Foundations",
            ),
            provider=provider,
            settings=cfg,
        )
    )
    assert len(exercise.exercise.steps) >= 2

    plan = asyncio.run(
        generate_remedial(
            RemedialGenerateRequest(
                class_id="class-1",
                class_title="State basics",
                course_title="Python Foundations",
                quiz_score=45,
                passing_score=80,
                gaps=[{
                    "competency": "Applied understanding",
                    "description": "Answers recognise state but do not predict changes.",
                    "severity": "medium",
                    "recommendation": "Re-read the explanation, then complete one unaided task.",
                }],
            ),
            provider=provider,
            settings=cfg,
        )
    ).plan
    assert len(plan.activities) >= 2
