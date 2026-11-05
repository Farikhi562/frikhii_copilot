from __future__ import annotations

import json
import re
from typing import Iterable

from app.core.errors import ContentValidationError
from app.schemas.curriculum import (
    ClassBlueprint,
    CourseBlueprint,
    CurriculumGenerateRequest,
    ModuleBlueprint,
    course_counts,
)

MAX_COURSE_BYTES = 512_000
URL_PATTERN = re.compile(r"(https?://|www\.|doi\.org|arxiv\.org)", re.IGNORECASE)


def _fail(errors: list[str]) -> None:
    if errors:
        raise ContentValidationError(
            "Generated curriculum failed structural validation.",
            details={"errors": errors[:40]},
        )


def _walk_strings(value: object) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _walk_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _walk_strings(item)


def _check_text_safety(course: CourseBlueprint, errors: list[str]) -> None:
    for text in _walk_strings(course.model_dump(mode="json")):
        if URL_PATTERN.search(text):
            errors.append(
                "The output contains a URL or citation-like reference. Use a suggested search "
                "topic instead of an invented or unverified source."
            )
            break


def _check_ids_and_sequences(course: CourseBlueprint, errors: list[str]) -> None:
    seen: set[str] = set()
    global_class_order: dict[str, tuple[int, int]] = {}

    def claim(identifier: str, where: str) -> None:
        if identifier in seen:
            errors.append(f"Duplicate id '{identifier}' at {where}.")
        seen.add(identifier)

    for objective in course.objectives:
        claim(objective.id, "course objectives")
    for competency in course.target_competencies:
        claim(competency.id, "target competencies")

    if len(course.modules) > 12:
        errors.append("A course may not contain more than 12 modules.")

    class_total = 0
    lesson_total = 0
    for module_index, module in enumerate(course.modules):
        claim(module.id, f"module {module_index + 1}")
        if module.sequence != module_index + 1:
            errors.append(f"Module '{module.id}' has a non-contiguous sequence.")
        for objective in module.objectives:
            claim(objective.id, f"module {module.id} objectives")
        if len(module.classes) > 8:
            errors.append(f"Module '{module.id}' contains more than 8 classes.")
        for class_index, klass in enumerate(module.classes):
            class_total += 1
            claim(klass.id, f"class {klass.id}")
            if klass.sequence != class_index + 1:
                errors.append(f"Class '{klass.id}' has a non-contiguous sequence inside its module.")
            global_class_order[klass.id] = (module.sequence, klass.sequence)
            for objective in klass.objectives:
                claim(objective.id, f"class {klass.id} objectives")
            for lesson_index, lesson in enumerate(klass.lessons):
                lesson_total += 1
                claim(lesson.id, f"lesson {lesson.id}")
                if lesson.sequence != lesson_index + 1:
                    errors.append(f"Lesson '{lesson.id}' has a non-contiguous sequence.")
    if class_total > 60:
        errors.append("A course may not contain more than 60 classes.")
    if lesson_total > 300:
        errors.append("A course may not contain more than 300 lessons.")

    # Prerequisite references and ordering.
    module_positions = {module.id: module.sequence for module in course.modules}
    for module in course.modules:
        for prerequisite in module.required_previous_module_ids:
            if prerequisite not in module_positions:
                errors.append(f"Module '{module.id}' references unknown module '{prerequisite}'.")
            elif module_positions[prerequisite] >= module.sequence:
                errors.append(
                    f"Module '{module.id}' requires '{prerequisite}', which is not earlier."
                )

    for module in course.modules:
        for klass in module.classes:
            for prerequisite in klass.prerequisite_class_ids:
                if prerequisite not in global_class_order:
                    errors.append(f"Class '{klass.id}' references unknown class '{prerequisite}'.")
                    continue
                if global_class_order[prerequisite] >= global_class_order[klass.id]:
                    errors.append(
                        f"Class '{klass.id}' requires '{prerequisite}', which is not earlier in the path."
                    )

    _check_cycles(course.modules, errors)


def _check_cycles(modules: list[ModuleBlueprint], errors: list[str]) -> None:
    """Belt-and-braces cycle detection for module and class prerequisite graphs."""

    module_graph = {m.id: set(m.required_previous_module_ids) for m in modules}
    class_graph: dict[str, set[str]] = {}
    for module in modules:
        for klass in module.classes:
            class_graph[klass.id] = set(klass.prerequisite_class_ids)

    def has_cycle(graph: dict[str, set[str]]) -> bool:
        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(node: str) -> bool:
            if node in visiting:
                return True
            if node in visited:
                return False
            visiting.add(node)
            for neighbour in graph.get(node, set()):
                if neighbour in graph and visit(neighbour):
                    return True
            visiting.remove(node)
            visited.add(node)
            return False

        return any(visit(node) for node in graph)

    if has_cycle(module_graph):
        errors.append("The module prerequisites contain a cycle.")
    if has_cycle(class_graph):
        errors.append("The class prerequisites contain a cycle.")


def _check_durations(course: CourseBlueprint, request: CurriculumGenerateRequest, errors: list[str]) -> None:
    module_total = 0
    for module in course.modules:
        module_class_total = 0
        for klass in module.classes:
            class_total = sum(lesson.estimated_duration_minutes for lesson in klass.lessons)
            if class_total > klass.estimated_duration_minutes * 2 + 60:
                errors.append(
                    f"Class '{klass.id}' lessons exceed its class duration without justification."
                )
            module_class_total += klass.estimated_duration_minutes
        if module_class_total > module.estimated_duration_minutes * 2 + 240:
            errors.append(f"Module '{module.id}' duration is inconsistent with its classes.")
        module_total += module.estimated_duration_minutes

    if course.estimated_duration_minutes < int(module_total * 0.8):
        errors.append("Course duration is shorter than the sum of its modules.")
    if course.estimated_duration_minutes > module_total * 2 + 1440:
        errors.append("Course duration is implausibly larger than the sum of its modules.")

    available = request.learning_goal.weekly_study_minutes
    recommended = course.recommended_weekly_study_minutes
    if recommended > available * 2 or recommended < available * 0.25:
        errors.append(
            "Recommended weekly study time is inconsistent with the learner's available time."
        )


def _check_structure(course: CourseBlueprint, errors: list[str]) -> None:
    if not course.objectives:
        errors.append("A course must have at least one learning objective.")
    if not course.target_competencies:
        errors.append("A course must define target competencies.")
    if not course.final_project.title.strip():
        errors.append("The course must include a meaningful final project.")
    for module in course.modules:
        if not module.classes:
            errors.append(f"Module '{module.id}' contains no classes.")
        for klass in module.classes:
            if not klass.lessons:
                errors.append(f"Class '{klass.id}' contains no lessons.")
            if not klass.objectives:
                errors.append(f"Class '{klass.id}' has no learning objectives.")
            if not klass.exercise.evaluation_criteria:
                errors.append(f"Class '{klass.id}' exercise has no evaluation criteria.")
            for lesson in klass.lessons:
                blueprint = lesson.blueprint
                for field_name in (
                    "introduction",
                    "concept_outline",
                    "analogies",
                    "demonstration",
                    "guided_practice",
                    "independent_practice",
                    "knowledge_check",
                    "summary",
                ):
                    if not getattr(blueprint, field_name):
                        errors.append(f"Lesson '{lesson.id}' blueprint is missing {field_name}.")


def validate_curriculum(course: CourseBlueprint, request: CurriculumGenerateRequest) -> list[str]:
    errors: list[str] = []
    _check_text_safety(course, errors)
    _check_ids_and_sequences(course, errors)
    _check_structure(course, errors)
    _check_durations(course, request, errors)

    size = len(json.dumps(course.model_dump(mode="json"), ensure_ascii=False).encode("utf-8"))
    if size > MAX_COURSE_BYTES:
        errors.append("Generated curriculum exceeds the maximum allowed size.")

    _fail(errors)

    warnings: list[str] = []
    counts = course_counts(course)
    if counts["classes"] < 2:
        warnings.append("This is a very short curriculum; review whether it covers the goal.")
    total_hours = course.estimated_duration_minutes / 60
    if total_hours > 200:
        warnings.append("This curriculum is unusually long. Review the scope before approving.")
    if course.recommended_weekly_study_minutes > request.learning_goal.weekly_study_minutes:
        warnings.append(
            "The recommended weekly study time is above the learner's stated availability."
        )
    return warnings


def summarize_for_prompt(course: CourseBlueprint) -> str:
    parts = [f"Course: {course.title}", f"Objectives: {len(course.objectives)}", "Modules:"]
    for module in course.modules:
        parts.append(f"- {module.title}: {len(module.classes)} classes")
    return "\n".join(parts)
