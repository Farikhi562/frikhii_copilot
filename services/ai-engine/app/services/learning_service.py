"""Learning Engine AI services: lesson generation, quiz gen/eval, exercise gen, remedial."""

from __future__ import annotations

import logging

from app.core.config import Settings
from app.core.errors import ContentValidationError
from app.prompts.learning import (
    PROMPT_VERSION,
    build_exercise_prompt,
    build_lesson_prompt,
    build_quiz_evaluate_prompt,
    build_quiz_prompt,
    build_remedial_prompt,
)
from app.providers.base import LLMProvider
from app.schemas.learning import (
    AuthoredExercise,
    AuthoredLesson,
    ExerciseGenerateRequest,
    ExerciseGenerateResult,
    LessonGenerateRequest,
    LessonGenerateResult,
    QuizEvaluation,
    QuizEvaluateRequest,
    QuizEvaluateResult,
    QuizGenerateRequest,
    QuizGenerateResult,
    QuizGenerationPayload,
    RemedialGenerateRequest,
    RemedialGenerateResult,
    RemedialPlan,
)
from app.services.common import build_metadata, generate_validated

logger = logging.getLogger(__name__)


async def generate_lesson(
    request: LessonGenerateRequest,
    *,
    provider: LLMProvider,
    settings: Settings,
) -> LessonGenerateResult:
    schema = AuthoredLesson.model_json_schema()
    system_prompt, user_prompt = build_lesson_prompt(request, schema)
    payload = request.model_dump(mode="json")

    def parse(data: dict) -> AuthoredLesson:
        return AuthoredLesson.model_validate(data)

    def validate(lesson: AuthoredLesson) -> None:
        if lesson.lesson_id != request.lesson_id:
            raise ContentValidationError(
                f"lesson_id mismatch: expected {request.lesson_id!r}, got {lesson.lesson_id!r}"
            )
        if len(lesson.sections) < 4:
            raise ContentValidationError("Lesson must have at least 4 sections.")

    lesson, result, repaired = await generate_validated(
        provider=provider,
        task="lesson_generate",
        schema_name="authored_lesson",
        schema=schema,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        payload=payload,
        settings=settings,
        parse=parse,
        validate=validate,
    )
    logger.info(
        "lesson generated id=%s sections=%s provider=%s repaired=%s",
        lesson.lesson_id, len(lesson.sections), result.provider, repaired,
    )
    return LessonGenerateResult(
        lesson=lesson,
        metadata=build_metadata(result, repaired=repaired, prompt_version=PROMPT_VERSION),
    )


async def generate_quiz(
    request: QuizGenerateRequest,
    *,
    provider: LLMProvider,
    settings: Settings,
) -> QuizGenerateResult:
    schema = QuizGenerationPayload.model_json_schema()
    system_prompt, user_prompt = build_quiz_prompt(request, schema)
    payload = request.model_dump(mode="json")

    def parse(data: dict) -> QuizGenerationPayload:
        return QuizGenerationPayload.model_validate(data)

    def validate(parsed: QuizGenerationPayload) -> None:
        q_ids = {q.id for q in parsed.questions}
        k_ids = {k.question_id for k in parsed.answer_keys}
        if q_ids != k_ids:
            raise ContentValidationError("Quiz answer keys do not match question ids.")
        seqs = [q.sequence for q in parsed.questions]
        if sorted(seqs) != list(range(1, len(seqs) + 1)):
            raise ContentValidationError("Quiz question sequences must start at 1 and be contiguous.")

    parsed, result, repaired = await generate_validated(
        provider=provider,
        task="quiz_generate",
        schema_name="quiz_generation",
        schema=schema,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        payload=payload,
        settings=settings,
        parse=parse,
        validate=validate,
    )
    logger.info(
        "quiz generated class=%s questions=%s provider=%s repaired=%s",
        request.class_id, len(parsed.questions), result.provider, repaired,
    )
    return QuizGenerateResult(
        questions=parsed.questions,
        answer_keys=parsed.answer_keys,
        passing_score=parsed.passing_score,
        metadata=build_metadata(result, repaired=repaired, prompt_version=PROMPT_VERSION),
    )


async def evaluate_quiz(
    request: QuizEvaluateRequest,
    *,
    provider: LLMProvider,
    settings: Settings,
) -> QuizEvaluateResult:
    q_ids = {q.id for q in request.questions}
    k_ids = {k.question_id for k in request.answer_keys}
    a_ids = {a.question_id for a in request.answers}
    if q_ids != k_ids:
        raise ContentValidationError("Quiz answer keys do not match question ids.")
    if q_ids != a_ids:
        raise ContentValidationError("Every quiz question must be answered exactly once.")

    schema = QuizEvaluation.model_json_schema()
    system_prompt, user_prompt = build_quiz_evaluate_prompt(request, schema)
    payload = request.model_dump(mode="json")

    def parse(data: dict) -> QuizEvaluation:
        return QuizEvaluation.model_validate(data)

    def validate(ev: QuizEvaluation) -> None:
        scored_ids = {s.question_id for s in ev.question_scores}
        if scored_ids != q_ids:
            raise ContentValidationError("Evaluation must score every quiz question.")
        expected_passed = ev.score >= request.passing_score
        if ev.passed != expected_passed:
            raise ContentValidationError(
                f"passed flag ({ev.passed}) does not match score {ev.score} vs passing {request.passing_score}."
            )

    evaluation, result, repaired = await generate_validated(
        provider=provider,
        task="quiz_evaluate",
        schema_name="quiz_evaluation",
        schema=schema,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        payload=payload,
        settings=settings,
        parse=parse,
        validate=validate,
    )
    logger.info(
        "quiz evaluated class=%s score=%s passed=%s provider=%s repaired=%s",
        request.class_id, evaluation.score, evaluation.passed, result.provider, repaired,
    )
    return QuizEvaluateResult(
        evaluation=evaluation,
        metadata=build_metadata(result, repaired=repaired, prompt_version=PROMPT_VERSION),
    )


async def generate_exercise(
    request: ExerciseGenerateRequest,
    *,
    provider: LLMProvider,
    settings: Settings,
) -> ExerciseGenerateResult:
    schema = AuthoredExercise.model_json_schema()
    system_prompt, user_prompt = build_exercise_prompt(request, schema)
    payload = request.model_dump(mode="json")

    def parse(data: dict) -> AuthoredExercise:
        return AuthoredExercise.model_validate(data)

    def validate(ex: AuthoredExercise) -> None:
        if len(ex.steps) < 2:
            raise ContentValidationError("Exercise must have at least 2 steps.")

    exercise, result, repaired = await generate_validated(
        provider=provider,
        task="exercise_generate",
        schema_name="authored_exercise",
        schema=schema,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        payload=payload,
        settings=settings,
        parse=parse,
        validate=validate,
    )
    logger.info(
        "exercise generated class=%s steps=%s provider=%s repaired=%s",
        request.class_id, len(exercise.steps), result.provider, repaired,
    )
    return ExerciseGenerateResult(
        exercise=exercise,
        metadata=build_metadata(result, repaired=repaired, prompt_version=PROMPT_VERSION),
    )


async def generate_remedial(
    request: RemedialGenerateRequest,
    *,
    provider: LLMProvider,
    settings: Settings,
) -> RemedialGenerateResult:
    schema = RemedialPlan.model_json_schema()
    system_prompt, user_prompt = build_remedial_prompt(request, schema)
    payload = request.model_dump(mode="json")

    def parse(data: dict) -> RemedialPlan:
        return RemedialPlan.model_validate(data)

    def validate(plan: RemedialPlan) -> None:
        if len(plan.activities) < 2:
            raise ContentValidationError("Remedial plan must have at least 2 activities.")
        seqs = [a.sequence for a in plan.activities]
        if sorted(seqs) != list(range(1, len(seqs) + 1)):
            raise ContentValidationError("Activity sequences must start at 1 and be contiguous.")

    plan, result, repaired = await generate_validated(
        provider=provider,
        task="remedial_generate",
        schema_name="remedial_plan",
        schema=schema,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        payload=payload,
        settings=settings,
        parse=parse,
        validate=validate,
    )
    logger.info(
        "remedial generated class=%s activities=%s provider=%s repaired=%s",
        request.class_id, len(plan.activities), result.provider, repaired,
    )
    return RemedialGenerateResult(
        plan=plan,
        metadata=build_metadata(result, repaired=repaired, prompt_version=PROMPT_VERSION),
    )
