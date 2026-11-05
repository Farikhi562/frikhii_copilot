from __future__ import annotations

import logging

from app.core.config import Settings
from app.core.errors import ContentValidationError
from app.prompts.diagnostic import (
    build_diagnostic_evaluation_prompt,
    build_diagnostic_generation_prompt,
)
from app.providers.base import LLMProvider
from app.schemas.diagnostic import (
    DiagnosticEvaluateRequest,
    DiagnosticEvaluation,
    DiagnosticEvaluationResult,
    DiagnosticGenerateRequest,
    DiagnosticGenerationPayload,
    DiagnosticGenerationResult,
)
from app.services.common import build_metadata, generate_validated
from app.validators.diagnostic import validate_evaluation, validate_question_set

logger = logging.getLogger(__name__)


async def generate_diagnostic(
    request: DiagnosticGenerateRequest,
    *,
    provider: LLMProvider,
    settings: Settings,
) -> DiagnosticGenerationResult:
    schema = DiagnosticGenerationPayload.model_json_schema()
    system_prompt, user_prompt = build_diagnostic_generation_prompt(request, schema)
    payload = request.model_dump(mode="json")

    def parse(data: dict) -> DiagnosticGenerationPayload:
        return DiagnosticGenerationPayload.model_validate(data)

    def validate(parsed: DiagnosticGenerationPayload) -> None:
        validate_question_set(
            parsed.question_set,
            [key.model_dump(mode="json") for key in parsed.answer_keys],
        )

    parsed, result, repaired = await generate_validated(
        provider=provider,
        task="diagnostic_generate",
        schema_name="diagnostic_generation",
        schema=schema,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        payload=payload,
        settings=settings,
        parse=parse,
        validate=validate,
    )
    logger.info(
        "diagnostic generated questions=%s provider=%s repaired=%s",
        len(parsed.question_set.questions),
        result.provider,
        repaired,
    )
    return DiagnosticGenerationResult(
        question_set=parsed.question_set,
        answer_keys=parsed.answer_keys,
        metadata=build_metadata(result, repaired=repaired),
    )


async def evaluate_diagnostic(
    request: DiagnosticEvaluateRequest,
    *,
    provider: LLMProvider,
    settings: Settings,
) -> DiagnosticEvaluationResult:
    question_ids = {question.id for question in request.questions}
    key_ids = {key.question_id for key in request.answer_keys}
    answer_ids = {answer.question_id for answer in request.answers}
    if len(key_ids) != len(request.answer_keys):
        raise ContentValidationError("The diagnostic answer key contains duplicate question ids.")
    if len(answer_ids) != len(request.answers):
        raise ContentValidationError("A diagnostic question may be answered only once.")
    if question_ids != key_ids:
        raise ContentValidationError("The diagnostic answer key does not match its questions.")
    if question_ids != answer_ids:
        raise ContentValidationError("Every diagnostic question must be answered exactly once.")

    schema = DiagnosticEvaluation.model_json_schema()
    system_prompt, user_prompt = build_diagnostic_evaluation_prompt(request, schema)
    payload = request.model_dump(mode="json")

    def parse(data: dict) -> DiagnosticEvaluation:
        return DiagnosticEvaluation.model_validate(data)

    def validate(parsed: DiagnosticEvaluation) -> None:
        validate_evaluation(parsed, request.questions)

    parsed, result, repaired = await generate_validated(
        provider=provider,
        task="diagnostic_evaluate",
        schema_name="diagnostic_evaluation",
        schema=schema,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        payload=payload,
        settings=settings,
        parse=parse,
        validate=validate,
    )
    logger.info(
        "diagnostic evaluated level=%s provider=%s repaired=%s",
        parsed.estimated_level,
        result.provider,
        repaired,
    )
    return DiagnosticEvaluationResult(
        evaluation=parsed,
        metadata=build_metadata(result, repaired=repaired),
    )
