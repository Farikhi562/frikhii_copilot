from __future__ import annotations

import logging

from app.core.config import Settings
from app.prompts.learner import PROMPT_VERSION, build_insights_prompt
from app.providers.base import LLMProvider
from app.schemas.learner import InsightsPayload, InsightsRequest, InsightsResult
from app.services.common import build_metadata, generate_validated
from app.validators.learner import validate_insights

logger = logging.getLogger(__name__)


async def generate_insights(
    request: InsightsRequest,
    *,
    provider: LLMProvider,
    settings: Settings,
) -> InsightsResult:
    """Ask the provider for evidence-cited insights. Output is validated and may be repaired once."""

    schema = InsightsPayload.model_json_schema()
    payload = request.model_dump(mode="json", exclude={"request_id"})
    system_prompt, user_prompt = build_insights_prompt(payload, schema)

    parsed, result, repaired = await generate_validated(
        provider=provider,
        task="learner_insights",
        schema_name="learner_insights",
        schema=schema,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        payload=payload,
        settings=settings,
        parse=InsightsPayload.model_validate,
        validate=lambda parsed: validate_insights(parsed, request),
    )
    logger.info("learner insights generated count=%s provider=%s repaired=%s", len(parsed.insights), result.provider, repaired)
    metadata = build_metadata(result, repaired=repaired, prompt_version=PROMPT_VERSION)
    return InsightsResult(insights=parsed.insights, metadata=metadata.model_dump(mode="json"))
