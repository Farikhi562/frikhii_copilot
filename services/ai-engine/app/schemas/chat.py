from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(..., min_length=1, max_length=10000)


class ChatContext(BaseModel):
    course_id: str | None = None
    course_title: str | None = None
    module_title: str | None = None
    class_title: str | None = None
    lesson_id: str | None = None
    lesson_title: str | None = None
    lesson_objectives: list[str] = Field(default_factory=list)
    user_level: str | None = None


class ChatRequestPayload(BaseModel):
    mode: Literal["explain", "deep_dive", "practice", "socratic", "review", "project"] = "explain"
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=50)
    context: ChatContext | None = None
    temperature: float | None = Field(default=None, ge=0.0, le=1.5)
    max_tokens: int | None = Field(default=None, ge=128, le=8192)


class ChatResponseData(BaseModel):
    text: str
    model: str
    provider: str
    tutor_mode: str
    usage: dict[str, int] = Field(default_factory=dict)
    finish_reason: str | None = None
    fallback_used: bool = False
    duration_ms: int = 0


class ChatResponse(BaseModel):
    success: bool = True
    data: ChatResponseData | None = None
    error: str | None = None
