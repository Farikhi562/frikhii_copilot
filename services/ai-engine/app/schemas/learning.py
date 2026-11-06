"""Schemas for the Learning Engine: lesson generation, quiz generation/evaluation,
exercise generation, and remedial plan generation.
"""

from __future__ import annotations

from typing import Annotated

from pydantic import Field, StringConstraints

from app.schemas.common import (
    Choice,
    Difficulty,
    Id,
    LongText,
    ProviderMetadata,
    RubricCriterion,
    ShortText,
    StrictModel,
)
from app.schemas.diagnostic import KnowledgeGap


# ---------------------------------------------------------------------------
# Lesson generation
# ---------------------------------------------------------------------------

class LessonSection(StrictModel):
    """A single authored section inside a lesson."""
    type: Annotated[str, StringConstraints(
        pattern=r"^(introduction|objective|concept|analogy|demonstration|guided_practice|independent_practice|knowledge_check|summary)$"
    )]
    title: ShortText
    body: LongText
    # Optional sub-items: e.g. bullet points, steps
    items: list[LongText] = Field(default_factory=list, max_length=12)


class AuthoredLesson(StrictModel):
    """Fully expanded lesson content generated from a blueprint."""
    lesson_id: str = Field(min_length=1, max_length=80)
    title: ShortText
    estimated_duration_minutes: int = Field(ge=5, le=300)
    sections: list[LessonSection] = Field(min_length=4, max_length=12)
    key_takeaways: list[LongText] = Field(min_length=1, max_length=6)
    further_search_topics: list[ShortText] = Field(default_factory=list, max_length=6)


class LessonGenerateRequest(StrictModel):
    lesson_id: str = Field(min_length=1, max_length=80)
    title: ShortText
    description: LongText
    blueprint: dict  # raw LessonBlueprint JSON from the course version
    course_title: ShortText
    class_title: ShortText
    learning_language: str = Field(default="en-US", max_length=20)
    learner_level: Difficulty = Difficulty.foundation
    request_id: str | None = Field(default=None, max_length=100)


class LessonGenerateResult(StrictModel):
    lesson: AuthoredLesson
    metadata: ProviderMetadata


# ---------------------------------------------------------------------------
# Quiz generation
# ---------------------------------------------------------------------------

class QuizQuestion(StrictModel):
    id: Id
    sequence: int = Field(ge=1, le=15)
    type: Annotated[str, StringConstraints(
        pattern=r"^(multiple_choice|short_answer|scenario|reasoning)$"
    )]
    prompt: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=1500)]
    competency: ShortText
    difficulty: Difficulty
    choices: list[Choice] = Field(default_factory=list, max_length=6)
    explanation: LongText = ""


class QuizAnswerKey(StrictModel):
    question_id: Id
    expected_answer: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    rubric: list[RubricCriterion] = Field(default_factory=list, max_length=6)


class QuizGenerationPayload(StrictModel):
    questions: list[QuizQuestion] = Field(min_length=3, max_length=10)
    answer_keys: list[QuizAnswerKey] = Field(min_length=3, max_length=10)
    passing_score: int = Field(ge=50, le=100, default=70)


class QuizGenerateRequest(StrictModel):
    class_id: str = Field(min_length=1, max_length=80)
    class_title: ShortText
    class_description: LongText
    competencies: list[ShortText] = Field(min_length=1, max_length=8)
    knowledge_check_description: LongText
    question_count: int = Field(default=5, ge=3, le=10)
    course_title: ShortText
    learning_language: str = Field(default="en-US", max_length=20)
    learner_level: Difficulty = Difficulty.foundation
    request_id: str | None = Field(default=None, max_length=100)


class QuizGenerateResult(StrictModel):
    questions: list[QuizQuestion]
    answer_keys: list[QuizAnswerKey]
    passing_score: int
    metadata: ProviderMetadata


# ---------------------------------------------------------------------------
# Quiz evaluation
# ---------------------------------------------------------------------------

class QuizAnswerInput(StrictModel):
    question_id: Id
    response: Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]


class QuizQuestionScore(StrictModel):
    question_id: Id
    score: int = Field(ge=0, le=100)
    feedback: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=1000)]


class QuizEvaluation(StrictModel):
    score: int = Field(ge=0, le=100)
    passed: bool
    summary: LongText
    strengths: list[ShortText] = Field(default_factory=list, max_length=6)
    gaps: list[KnowledgeGap] = Field(default_factory=list, max_length=8)
    question_scores: list[QuizQuestionScore] = Field(min_length=3, max_length=10)


class QuizEvaluateRequest(StrictModel):
    class_id: str = Field(min_length=1, max_length=80)
    class_title: ShortText
    questions: list[QuizQuestion] = Field(min_length=3, max_length=10)
    answer_keys: list[QuizAnswerKey] = Field(min_length=3, max_length=10)
    answers: list[QuizAnswerInput] = Field(min_length=3, max_length=10)
    passing_score: int = Field(ge=50, le=100, default=70)
    request_id: str | None = Field(default=None, max_length=100)


class QuizEvaluateResult(StrictModel):
    evaluation: QuizEvaluation
    metadata: ProviderMetadata


# ---------------------------------------------------------------------------
# Exercise generation
# ---------------------------------------------------------------------------

class ExerciseGenerateRequest(StrictModel):
    class_id: str = Field(min_length=1, max_length=80)
    class_title: ShortText
    exercise_title: ShortText
    exercise_description: LongText
    difficulty: Difficulty
    competency: ShortText
    course_title: ShortText
    learning_language: str = Field(default="en-US", max_length=20)
    learner_level: Difficulty = Difficulty.foundation
    request_id: str | None = Field(default=None, max_length=100)


class ExerciseStep(StrictModel):
    step_number: int = Field(ge=1, le=20)
    instruction: LongText
    hint: LongText = ""


class AuthoredExercise(StrictModel):
    title: ShortText
    context: LongText
    steps: list[ExerciseStep] = Field(min_length=2, max_length=15)
    expected_deliverable: LongText
    evaluation_criteria: list[LongText] = Field(min_length=1, max_length=8)
    further_search_topics: list[ShortText] = Field(default_factory=list, max_length=4)


class ExerciseGenerateResult(StrictModel):
    exercise: AuthoredExercise
    metadata: ProviderMetadata


# ---------------------------------------------------------------------------
# Remedial plan generation
# ---------------------------------------------------------------------------

class RemedialActivity(StrictModel):
    sequence: int = Field(ge=1, le=20)
    title: ShortText
    description: LongText
    activity_type: Annotated[str, StringConstraints(
        pattern=r"^(review|practice|concept_deep_dive|worked_example|knowledge_check)$"
    )]
    estimated_minutes: int = Field(ge=5, le=120)
    target_gap: ShortText


class RemedialPlan(StrictModel):
    gap_summary: LongText
    estimated_total_minutes: int = Field(ge=15, le=600)
    activities: list[RemedialActivity] = Field(min_length=2, max_length=12)
    key_concepts_to_revisit: list[ShortText] = Field(min_length=1, max_length=8)
    further_search_topics: list[ShortText] = Field(default_factory=list, max_length=6)
    encouragement: LongText


class RemedialGenerateRequest(StrictModel):
    class_id: str = Field(min_length=1, max_length=80)
    class_title: ShortText
    course_title: ShortText
    quiz_score: int = Field(ge=0, le=100)
    passing_score: int = Field(ge=50, le=100)
    gaps: list[KnowledgeGap] = Field(min_length=1, max_length=10)
    strengths: list[ShortText] = Field(default_factory=list, max_length=6)
    learning_language: str = Field(default="en-US", max_length=20)
    learner_level: Difficulty = Difficulty.foundation
    weekly_study_minutes: int = Field(default=300, ge=30, le=10080)
    request_id: str | None = Field(default=None, max_length=100)


class RemedialGenerateResult(StrictModel):
    plan: RemedialPlan
    metadata: ProviderMetadata
