from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.core.security import require_internal_token
from app.providers.registry import get_provider
from app.schemas.chat import ChatRequestPayload, ChatResponse
from app.schemas.curriculum import CurriculumGenerateRequest, CurriculumGenerationResult
from app.schemas.diagnostic import (
    DiagnosticEvaluateRequest,
    DiagnosticEvaluationResult,
    DiagnosticGenerateRequest,
    DiagnosticGenerationResult,
)
from app.schemas.learning import (
    ExerciseGenerateRequest,
    ExerciseGenerateResult,
    LessonGenerateRequest,
    LessonGenerateResult,
    QuizEvaluateRequest,
    QuizEvaluateResult,
    QuizGenerateRequest,
    QuizGenerateResult,
    RemedialGenerateRequest,
    RemedialGenerateResult,
)
from app.services.chat_service import chat_completion
from app.services.curriculum_service import generate_curriculum
from app.services.diagnostic_service import evaluate_diagnostic, generate_diagnostic
from app.services.learning_service import (
    evaluate_quiz,
    generate_exercise,
    generate_lesson,
    generate_quiz,
    generate_remedial,
)

router = APIRouter(prefix="/internal/v1", dependencies=[Depends(require_internal_token)])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequestPayload) -> ChatResponse:
    return await chat_completion(request, provider=get_provider(), settings=get_settings())


@router.post("/diagnostic/generate", response_model=DiagnosticGenerationResult)
async def diagnostic_generate(request: DiagnosticGenerateRequest) -> DiagnosticGenerationResult:
    return await generate_diagnostic(request, provider=get_provider(), settings=get_settings())


@router.post("/diagnostic/evaluate", response_model=DiagnosticEvaluationResult)
async def diagnostic_evaluate(request: DiagnosticEvaluateRequest) -> DiagnosticEvaluationResult:
    return await evaluate_diagnostic(request, provider=get_provider(), settings=get_settings())


@router.post("/course/generate", response_model=CurriculumGenerationResult)
async def course_generate(request: CurriculumGenerateRequest) -> CurriculumGenerationResult:
    return await generate_curriculum(request, provider=get_provider(), settings=get_settings())


# ── Learning Engine ─────────────────────────────────────────────────────────

@router.post("/lesson/generate", response_model=LessonGenerateResult)
async def lesson_generate(request: LessonGenerateRequest) -> LessonGenerateResult:
    return await generate_lesson(request, provider=get_provider(), settings=get_settings())


@router.post("/quiz/generate", response_model=QuizGenerateResult)
async def quiz_generate(request: QuizGenerateRequest) -> QuizGenerateResult:
    return await generate_quiz(request, provider=get_provider(), settings=get_settings())


@router.post("/quiz/evaluate", response_model=QuizEvaluateResult)
async def quiz_evaluate(request: QuizEvaluateRequest) -> QuizEvaluateResult:
    return await evaluate_quiz(request, provider=get_provider(), settings=get_settings())


@router.post("/exercise/generate", response_model=ExerciseGenerateResult)
async def exercise_generate(request: ExerciseGenerateRequest) -> ExerciseGenerateResult:
    return await generate_exercise(request, provider=get_provider(), settings=get_settings())


@router.post("/remedial/generate", response_model=RemedialGenerateResult)
async def remedial_generate(request: RemedialGenerateRequest) -> RemedialGenerateResult:
    return await generate_remedial(request, provider=get_provider(), settings=get_settings())
