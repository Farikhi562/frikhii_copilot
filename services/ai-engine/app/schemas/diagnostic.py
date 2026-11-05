from __future__ import annotations

from typing import Annotated, Any

from pydantic import Field, StringConstraints

from app.schemas.common import (
    Choice,
    Competency,
    Confidence,
    Difficulty,
    EstimatedLevel,
    Id,
    LearningGoalContext,
    LongText,
    Prerequisite,
    ProviderMetadata,
    QuestionType,
    RubricCriterion,
    Severity,
    ShortText,
    StrictModel,
)


class TopicAnalysis(StrictModel):
    normalized_topic: ShortText
    summary: LongText
    prerequisites: list[Prerequisite] = Field(min_length=0, max_length=10)
    competencies: list[Competency] = Field(min_length=1, max_length=12)
    complexity: Annotated[str, StringConstraints(pattern=r"^(low|medium|high)$")]
    assumptions: list[LongText] = Field(default_factory=list, max_length=10)


class DiagnosticQuestion(StrictModel):
    id: Id
    sequence: int = Field(ge=1, le=20)
    type: QuestionType
    prompt: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=1500)]
    competency: ShortText
    difficulty: Difficulty
    choices: list[Choice] = Field(default_factory=list, max_length=8)
    explanation: LongText


class AnswerKey(StrictModel):
    question_id: Id
    expected_answer: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    rubric: list[RubricCriterion] = Field(default_factory=list, max_length=6)


class DiagnosticQuestionSet(StrictModel):
    analysis: TopicAnalysis
    questions: list[DiagnosticQuestion] = Field(min_length=5, max_length=8)
    estimated_minutes: int = Field(ge=3, le=60)
    warnings: list[LongText] = Field(default_factory=list, max_length=5)


class DiagnosticGenerateRequest(StrictModel):
    learning_goal: LearningGoalContext
    question_count: int = Field(default=6, ge=5, le=8)
    request_id: str | None = Field(default=None, max_length=100)


class DiagnosticGenerationPayload(StrictModel):
    question_set: DiagnosticQuestionSet
    answer_keys: list[AnswerKey] = Field(min_length=5, max_length=8)


class DiagnosticGenerationResult(StrictModel):
    question_set: DiagnosticQuestionSet
    answer_keys: list[AnswerKey]
    metadata: ProviderMetadata


class DiagnosticAnswerInput(StrictModel):
    question_id: Id
    response: Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]


class DiagnosticEvaluateRequest(StrictModel):
    learning_goal: LearningGoalContext
    questions: list[DiagnosticQuestion] = Field(min_length=5, max_length=8)
    answer_keys: list[AnswerKey] = Field(min_length=5, max_length=8)
    answers: list[DiagnosticAnswerInput] = Field(min_length=5, max_length=8)
    prior_level: EstimatedLevel | None = None
    request_id: str | None = Field(default=None, max_length=100)


class QuestionScore(StrictModel):
    question_id: Id
    score: int = Field(ge=0, le=100)
    feedback: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=1000)]


class Strength(StrictModel):
    competency: ShortText
    evidence: LongText


class KnowledgeGap(StrictModel):
    competency: ShortText
    description: LongText
    severity: Severity
    recommendation: LongText


class DiagnosticEvaluation(StrictModel):
    estimated_level: EstimatedLevel
    confidence: Confidence
    summary: LongText
    strengths: list[Strength] = Field(default_factory=list, max_length=8)
    gaps: list[KnowledgeGap] = Field(default_factory=list, max_length=10)
    misconceptions: list[LongText] = Field(default_factory=list, max_length=6)
    recommended_start: LongText
    rationale: LongText
    question_scores: list[QuestionScore] = Field(min_length=5, max_length=8)
    can_skip: list[ShortText] = Field(default_factory=list, max_length=8)


class DiagnosticEvaluationResult(StrictModel):
    evaluation: DiagnosticEvaluation
    metadata: ProviderMetadata


class DiagnosticContext(StrictModel):
    """The evaluated diagnostic passed from Go into curriculum generation."""

    estimated_level: EstimatedLevel
    confidence: Confidence = Confidence.medium
    summary: LongText
    strengths: list[Strength] = Field(default_factory=list, max_length=8)
    gaps: list[KnowledgeGap] = Field(default_factory=list, max_length=10)
    recommended_start: LongText
    rationale: LongText


def as_public_question(question: DiagnosticQuestion, *, include_explanation: bool = False) -> dict[str, Any]:
    """A defensive helper: expected answers never travel through this shape."""

    data = question.model_dump()
    if not include_explanation:
        data.pop("explanation", None)
    return data


# Kept for typing clarity in callers without importing pydantic internals.
AnswerText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]
