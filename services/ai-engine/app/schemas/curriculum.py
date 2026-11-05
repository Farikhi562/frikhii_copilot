from __future__ import annotations

from typing import Annotated, Any

from pydantic import Field, StringConstraints

from app.schemas.common import (
    Competency,
    Difficulty,
    EstimatedLevel,
    Id,
    LearningGoalContext,
    LongText,
    Objective,
    Prerequisite,
    ProviderMetadata,
    ShortText,
    StrictModel,
)
from app.schemas.diagnostic import DiagnosticContext


class LessonBlueprint(StrictModel):
    introduction: LongText
    objectives: list[LongText] = Field(min_length=1, max_length=6)
    prerequisite_concepts: list[ShortText] = Field(default_factory=list, max_length=8)
    concept_outline: list[LongText] = Field(min_length=1, max_length=12)
    analogies: list[LongText] = Field(min_length=1, max_length=6)
    demonstration: list[LongText] = Field(min_length=1, max_length=8)
    guided_practice: list[LongText] = Field(min_length=1, max_length=8)
    independent_practice: list[LongText] = Field(min_length=1, max_length=8)
    knowledge_check: list[LongText] = Field(min_length=1, max_length=6)
    summary: LongText


class ExerciseBlueprint(StrictModel):
    title: ShortText
    description: LongText
    difficulty: Difficulty
    competency: ShortText
    instructions: list[LongText] = Field(min_length=1, max_length=10)
    expected_deliverable: LongText
    evaluation_criteria: list[LongText] = Field(min_length=1, max_length=10)


class KnowledgeCheckBlueprint(StrictModel):
    description: LongText
    question_count: int = Field(ge=1, le=10)
    competencies: list[ShortText] = Field(min_length=1, max_length=6)


class LessonBlueprintEntry(StrictModel):
    id: Id
    sequence: int = Field(ge=1, le=10)
    title: ShortText
    description: LongText
    estimated_duration_minutes: int = Field(ge=5, le=300)
    blueprint: LessonBlueprint


class ClassBlueprint(StrictModel):
    id: Id
    sequence: int = Field(ge=1, le=12)
    title: ShortText
    description: LongText
    objectives: list[Objective] = Field(min_length=1, max_length=8)
    prerequisite_class_ids: list[Id] = Field(default_factory=list, max_length=8)
    estimated_duration_minutes: int = Field(ge=15, le=900)
    key_concepts: list[ShortText] = Field(min_length=1, max_length=12)
    lessons: list[LessonBlueprintEntry] = Field(min_length=1, max_length=8)
    exercise: ExerciseBlueprint
    knowledge_check: KnowledgeCheckBlueprint


class ModuleBlueprint(StrictModel):
    id: Id
    sequence: int = Field(ge=1, le=16)
    title: ShortText
    description: LongText
    objectives: list[Objective] = Field(min_length=1, max_length=8)
    skills: list[ShortText] = Field(min_length=1, max_length=10)
    estimated_duration_minutes: int = Field(ge=30, le=10_000)
    required_previous_module_ids: list[Id] = Field(default_factory=list, max_length=8)
    classes: list[ClassBlueprint] = Field(min_length=1, max_length=8)


class FinalProjectBlueprint(StrictModel):
    title: ShortText
    description: LongText
    competencies: list[ShortText] = Field(min_length=1, max_length=8)
    deliverable: LongText
    evaluation_criteria: list[LongText] = Field(min_length=1, max_length=10)


class FinalAssessmentBlueprint(StrictModel):
    title: ShortText
    description: LongText
    format: LongText
    competencies: list[ShortText] = Field(min_length=1, max_length=8)
    passing_criteria: list[LongText] = Field(min_length=1, max_length=8)


class CourseBlueprint(StrictModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=160)]
    short_description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=400)]
    description: LongText
    learning_goal: LongText
    target_learner_level: EstimatedLevel
    target_competencies: list[Competency] = Field(min_length=1, max_length=12)
    prerequisites: list[Prerequisite] = Field(default_factory=list, max_length=10)
    estimated_duration_minutes: int = Field(ge=60, le=30_000)
    recommended_weekly_study_minutes: int = Field(ge=30, le=2400)
    methodology: LongText
    expected_outcome: LongText
    objectives: list[Objective] = Field(min_length=1, max_length=12)
    modules: list[ModuleBlueprint] = Field(min_length=1, max_length=12)
    final_project: FinalProjectBlueprint
    final_assessment: FinalAssessmentBlueprint
    assumptions: list[LongText] = Field(default_factory=list, max_length=10)
    suggested_search_topics: list[ShortText] = Field(default_factory=list, max_length=10)


class CurriculumGenerateRequest(StrictModel):
    learning_goal: LearningGoalContext
    diagnostic: DiagnosticContext
    learner_corrections: Annotated[str, StringConstraints(strip_whitespace=True, max_length=3000)] = ""
    additional_instructions: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""
    previous_version_summary: Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)] = ""
    request_id: str | None = Field(default=None, max_length=100)


class CurriculumGenerationResult(StrictModel):
    course: CourseBlueprint
    warnings: list[LongText] = Field(default_factory=list, max_length=10)
    metadata: ProviderMetadata


def course_counts(course: CourseBlueprint) -> dict[str, int]:
    classes = [c for m in course.modules for c in m.classes]
    lessons = [l for c in classes for l in c.lessons]
    return {
        "modules": len(course.modules),
        "classes": len(classes),
        "lessons": len(lessons),
        "exercises": len(classes),
    }


def course_as_json(course: CourseBlueprint) -> dict[str, Any]:
    return course.model_dump(mode="json")
