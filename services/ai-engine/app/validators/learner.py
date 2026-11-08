from __future__ import annotations

from app.core.errors import ContentValidationError
from app.schemas.learner import InsightsPayload, InsightsRequest

# Phrases that would turn evidence into a claim about the person. Narrative insights must
# describe competencies and attempts only.
FORBIDDEN = (
    "iq",
    "intelligen",
    "lazy",
    "stupid",
    "dumb",
    "unmotivated",
    "disorder",
    "adhd",
    "dyslex",
    "autis",
    "depress",
    "anxiety",
    "personality",
    "gifted",
    "talentless",
    "hopeless",
    "bad at",
    "incapable",
)


def validate_insights(payload: InsightsPayload, request: InsightsRequest) -> None:
    known = {event.id for item in request.evidence for event in (item.events or [])}
    errors: list[str] = []
    for index, insight in enumerate(payload.insights):
        for event_id in insight.evidence_event_ids:
            if event_id not in known:
                errors.append(f"insights.{index}: evidence_event_ids contains an id that was not provided: {event_id}")
        text = f"{insight.statement} {insight.rationale}".lower()
        for word in FORBIDDEN:
            if word in text:
                errors.append(f"insights.{index}: do not make claims about the person ({word!r}); describe competencies and attempts only")
                break
    if errors:
        raise ContentValidationError("Generated insights failed validation.", details={"errors": errors})
