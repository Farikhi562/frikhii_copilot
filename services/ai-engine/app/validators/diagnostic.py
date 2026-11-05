from __future__ import annotations

from app.core.errors import ContentValidationError
from app.schemas.diagnostic import (
    DiagnosticEvaluation,
    DiagnosticQuestion,
    DiagnosticQuestionSet,
)
from app.schemas.common import QuestionType


def _fail(errors: list[str]) -> None:
    if errors:
        raise ContentValidationError(
            "Generated diagnostic failed structural validation.",
            details={"errors": errors[:40]},
        )


def validate_question_set(
    question_set: DiagnosticQuestionSet,
    answer_keys: list[dict],
) -> None:
    errors: list[str] = []
    questions = question_set.questions
    ids = [question.id for question in questions]
    if len(set(ids)) != len(ids):
        errors.append("Diagnostic question ids must be unique.")
    if len({question.sequence for question in questions}) != len(questions):
        errors.append("Diagnostic question sequences must be unique.")
    if [q.sequence for q in questions] != list(range(1, len(questions) + 1)):
        errors.append("Diagnostic question sequences must be contiguous, starting at 1.")
    if len(questions) < 5 or len(questions) > 8:
        errors.append("A diagnostic must contain between 5 and 8 questions.")

    key_by_id: dict[str, dict] = {}
    for key in answer_keys:
        question_id = key.get("question_id")
        if question_id in key_by_id:
            errors.append(f"Duplicate answer key for question '{question_id}'.")
        key_by_id[question_id] = key

    for question in questions:
        key = key_by_id.get(question.id)
        if key is None:
            errors.append(f"Question '{question.id}' has no answer key.")
            continue
        expected = str(key.get("expected_answer", "")).strip()
        if not expected:
            errors.append(f"Question '{question.id}' has an empty expected answer.")
        if question.type is QuestionType.multiple_choice:
            choice_ids = [choice.id for choice in question.choices]
            if len(choice_ids) < 2:
                errors.append(f"Multiple-choice question '{question.id}' needs at least 2 choices.")
            if len(set(choice_ids)) != len(choice_ids):
                errors.append(f"Question '{question.id}' has duplicate choice ids.")
            if expected not in choice_ids:
                errors.append(
                    f"Answer key for '{question.id}' must match one of its choice ids."
                )
        else:
            if question.choices:
                errors.append(f"Question '{question.id}' is not multiple choice but has choices.")
            rubric = key.get("rubric") or []
            if not rubric:
                errors.append(f"Open question '{question.id}' needs a grading rubric.")
            else:
                weights = [float(item.get("weight", 0)) for item in rubric]
                if abs(sum(weights) - 1.0) > 0.15:
                    errors.append(f"Rubric weights for '{question.id}' should sum to about 1.0.")

    for question_id in key_by_id:
        if question_id not in ids:
            errors.append(f"Answer key references unknown question '{question_id}'.")

    _fail(errors)


def validate_evaluation(evaluation: DiagnosticEvaluation, questions: list[DiagnosticQuestion]) -> None:
    errors: list[str] = []
    question_ids = {question.id for question in questions}
    scored = [score.question_id for score in evaluation.question_scores]
    if len(set(scored)) != len(scored):
        errors.append("Each question may be scored only once.")
    if set(scored) != question_ids:
        errors.append("Every diagnostic question must receive a score.")
    if len(evaluation.question_scores) < 5:
        errors.append("The evaluation is missing question scores.")
    for gap in evaluation.gaps:
        if not gap.recommendation.strip():
            errors.append("Each knowledge gap needs a recommendation.")
    if not evaluation.summary.strip() or not evaluation.rationale.strip():
        errors.append("The evaluation needs a summary and rationale.")
    _fail(errors)
