"""Phase 04 internal routes. Mount with: app.include_router(learner_router) (see docs/PHASE_04_INTEGRATION.md)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.core.security import require_internal_token
from app.prompts.learner import render_tutor_guidance
from app.providers.registry import get_provider
from app.schemas.learner import InsightsRequest, InsightsResult, TutorGuidance
from app.services.learner_service import generate_insights

router = APIRouter(prefix="/internal/v1/learner", dependencies=[Depends(require_internal_token)])


@router.post("/insights", response_model=InsightsResult)
async def learner_insights(request: InsightsRequest) -> InsightsResult:
    return await generate_insights(request, provider=get_provider(), settings=get_settings())


@router.post("/tutor-guidance")
async def tutor_guidance(guidance: TutorGuidance) -> dict[str, str]:
    """Render Core API guidance into a system-prompt block for the tutor (no LLM call)."""

    return {"system_block": render_tutor_guidance(guidance)}
