"""Shared schema primitives.

All generated structures are validated with Pydantic before they leave the AI Engine.
The Go Core API validates them again before persistence: two independent layers, because
model output is untrusted input.
"""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

ID_PATTERN = r"^[a-z][a-z0-9_-]{1,39}$"
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=240)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=4000)]
Id = Annotated[str, StringConstraints(pattern=ID_PATTERN)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SelfReportedLevel(str, Enum):
    beginner = "beginner"
    basic = "basic"
    intermediate = "intermediate"
    advanced = "advanced"
    unsure = "unsure"


class EstimatedLevel(str, Enum):
    foundation = "foundation"
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class Difficulty(str, Enum):
    foundation = "foundation"
    intermediate = "intermediate"
    advanced = "advanced"


class QuestionType(str, Enum):
    multiple_choice = "multiple_choice"
    short_answer = "short_answer"
    scenario = "scenario"
    reasoning = "reasoning"


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Confidence(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class LearningGoalContext(StrictModel):
    title: ShortText
    goal_statement: Annotated[str, StringConstraints(strip_whitespace=True, min_length=8, max_length=2000)]
    intended_outcome: Annotated[str, StringConstraints(strip_whitespace=True, min_length=8, max_length=2000)]
    motivation: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=1500)]
    additional_context: Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)] = ""
    self_reported_level: SelfReportedLevel = SelfReportedLevel.unsure
    current_knowledge: dict[str, Any] = Field(default_factory=dict)
    weekly_study_minutes: int = Field(default=300, ge=30, le=10_080)
    learning_language: str = Field(default="en-US", max_length=20)
    learning_preferences: dict[str, Any] = Field(default_factory=dict)
    target_date: date | None = None


class Competency(StrictModel):
    id: Id
    name: ShortText
    description: LongText


class Prerequisite(StrictModel):
    concept: ShortText
    reason: LongText


class Objective(StrictModel):
    id: Id
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=8, max_length=400)]
    competency: ShortText


class RubricCriterion(StrictModel):
    criterion: ShortText
    description: LongText
    weight: float = Field(ge=0.0, le=1.0)


class Choice(StrictModel):
    id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class ProviderMetadata(StrictModel):
    provider: str
    model: str
    generated_at: str
    prompt_version: str
    duration_ms: int = Field(ge=0)
    repaired: bool = False
    fallback_used: bool = False
    fallback_reason: str | None = None
