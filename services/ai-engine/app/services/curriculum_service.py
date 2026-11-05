from __future__ import annotations

import logging

from app.core.config import Settings
from app.prompts.diagnostic import build_curriculum_prompt
from app.providers.base import LLMProvider
from app.schemas.curriculum import (
    CourseBlueprint,
    CurriculumGenerateRequest,
    CurriculumGenerationResult,
)
from app.services.common import build_metadata, generate_validated
from app.validators.curriculum import validate_curriculum

logger = logging.getLogger(__name__)


async def generate_curriculum(
    request: CurriculumGenerateRequest,
    *,
    provider: LLMProvider,
    settings: Settings,
) -> CurriculumGenerationResult:
    schema = CourseBlueprint.model_json_schema()
    system_prompt, user_prompt = build_curriculum_prompt(request, schema)
    payload = request.model_dump(mode="json")
    warnings: list[str] = []

    def parse(data: dict) -> CourseBlueprint:
        return CourseBlueprint.model_validate(data)

    def validate(course: CourseBlueprint) -> None:
        warnings.clear()
        warnings.extend(validate_curriculum(course, request))

    course, result, repaired = await generate_validated(
        provider=provider,
        task="curriculum_generate",
        schema_name="course_blueprint",
        schema=schema,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        payload=payload,
        settings=settings,
        parse=parse,
        validate=validate,
    )
    classes = sum(len(module.classes) for module in course.modules)
    logger.info(
        "curriculum generated modules=%s classes=%s provider=%s repaired=%s",
        len(course.modules),
        classes,
        result.provider,
        repaired,
    )
    return CurriculumGenerationResult(
        course=course,
        warnings=warnings,
        metadata=build_metadata(result, repaired=repaired),
    )
