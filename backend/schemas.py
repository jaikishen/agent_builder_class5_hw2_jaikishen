"""Pydantic models for the SkyNova `/chat` API contract.

Shape locked at phase 0 per spec.md §"API reference":
    { answer, tool_calls, warnings, elapsed_ms }

`history` is a follow-on addition for browser-side multi-turn: the client
sends prior Q&A pairs so the agent can resolve pronouns / follow-ups. The
backend itself remains stateless.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)


class ToolCall(BaseModel):
    tool: str
    input: dict
    output_preview: str


class ChatResponse(BaseModel):
    answer: str
    tool_calls: list[ToolCall] = []
    warnings: list[str] = []
    elapsed_ms: int
