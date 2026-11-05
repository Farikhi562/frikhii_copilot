from __future__ import annotations

import logging
from app.core.config import Settings
from app.core.errors import (
    LLMConfigurationError,
    LLMRateLimitError,
    LLMResponseError,
    LLMTimeoutError,
    LLMUnavailableError,
)
from app.prompts.tutor import build_tutor_system_instruction
from app.providers.base import ChatRequest, ChatTurn, LLMProvider
from app.schemas.chat import ChatRequestPayload, ChatResponse, ChatResponseData

logger = logging.getLogger(__name__)


async def chat_completion(
    request: ChatRequestPayload,
    *,
    provider: LLMProvider,
    settings: Settings,
) -> ChatResponse:
    context_dict = request.context.model_dump() if request.context else {}
    system_instruction = build_tutor_system_instruction(request.mode, context_dict)

    # Take the most recent turns to maintain token control and prevent oversized context
    recent_messages = request.messages[-20:]
    turns = [ChatTurn(role=m.role, content=m.content) for m in recent_messages]

    temperature = request.temperature if request.temperature is not None else settings.effective_temperature
    max_tokens = request.max_tokens if request.max_tokens is not None else settings.effective_max_output_tokens
    timeout = settings.effective_timeout

    chat_req = ChatRequest(
        system_instruction=system_instruction,
        messages=turns,
        temperature=temperature,
        max_output_tokens=max_tokens,
        timeout_seconds=timeout,
    )

    try:
        result = await provider.generate_chat(chat_req)
        return ChatResponse(
            success=True,
            data=ChatResponseData(
                text=result.text,
                model=result.model,
                provider=result.provider,
                tutor_mode=request.mode,
                usage=result.usage,
                finish_reason=result.finish_reason,
                fallback_used=result.fallback_used,
                duration_ms=result.duration_ms,
            ),
        )
    except (LLMConfigurationError, LLMRateLimitError, LLMResponseError, LLMTimeoutError, LLMUnavailableError) as exc:
        logger.error("AI Tutor chat completion error: %s", exc)
        return ChatResponse(
            success=False,
            error=str(exc),
        )
    except Exception as exc:
        logger.exception("Unexpected error during AI Tutor chat: %s", exc)
        return ChatResponse(
            success=False,
            error="The AI Tutor encountered an unexpected issue. Please try again.",
        )
