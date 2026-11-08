"""Phase 04 learner-intelligence contracts.

The Go Core API owns mastery, gaps, grades and unlock status. The AI Engine only receives
a compact evidence digest and returns narrative insights, each of which must cite event ids
that were actually in the request. Go validates the response again before storing it.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.schemas.common import StrictModel

EventId = Annotated[str, StringConstraints(min_length=1, max_length=80)]


class DigestEvent(StrictModel):
    id: EventId
    event_type: str = Field(max_length=40)
    score: float = Field(ge=0, le=1)
    at: str = Field(max_length=40)


class EvidenceDigest(StrictModel):
    competency: str = Field(min_length=2, max_length=160)
    status: Literal["not_started", "learning", "developing", "proficient", "mastered"]
    attempts: int = Field(ge=0)
    estimated_mastery: float = Field(ge=0, le=1)
    mistakes: list[str] | None = Field(default=None, max_length=10)
    events: list[DigestEvent] | None = Field(default=None, max_length=10)


class LearnerPreferences(StrictModel):
    explanation_style: Literal["simple", "balanced", "technical"] = "balanced"
    example_style: Literal["practical", "visual", "analogy", "mixed"] = "mixed"
    pace: Literal["slow", "steady", "fast"] = "steady"
    preferred_language: Literal["id-ID", "en-US"] = "en-US"
    daily_study_minutes: int | None = Field(default=None, ge=5, le=720)
    short_term_target: str = Field(default="", max_length=500)
    long_term_target: str = Field(default="", max_length=500)


class InsightsRequest(StrictModel):
    preferences: LearnerPreferences
    evidence: list[EvidenceDigest] = Field(min_length=1, max_length=40)
    request_id: str | None = Field(default=None, max_length=80)


class AIInsight(StrictModel):
    kind: Literal["strength", "pattern", "misconception", "strategy"]
    statement: str = Field(min_length=5, max_length=500)
    rationale: str = Field(min_length=5, max_length=800)
    evidence_event_ids: list[EventId] = Field(min_length=1, max_length=10)
    confidence: Literal["low", "medium", "high"]


class InsightsPayload(StrictModel):
    insights: list[AIInsight] = Field(max_length=5)


class InsightsResult(StrictModel):
    insights: list[AIInsight]
    metadata: dict


class TutorGuidance(StrictModel):
    approach: Literal["retrieval_review", "prerequisite_first", "worked_examples", "challenge", "standard"]
    focus: str = Field(max_length=160)
    reasons: list[str] = Field(default_factory=list, max_length=6)
    strengths: list[str] = Field(default_factory=list, max_length=20)
    review_first: list[str] = Field(default_factory=list, max_length=10)
    avoid_repeating: list[str] = Field(default_factory=list, max_length=20)
    certainty: Literal["low", "medium", "high"]
    style: dict[str, str]
