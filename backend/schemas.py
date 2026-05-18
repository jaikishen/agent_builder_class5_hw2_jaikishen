"""Pydantic models for the SkyNova `/chat` API contract.

Shape locked at phase 0 per spec.md §"API reference":
    { answer, tool_calls, warnings, elapsed_ms }
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)


class ToolCall(BaseModel):
    tool: str
    input: dict
    output_preview: str


class ChatResponse(BaseModel):
    answer: str
    tool_calls: list[ToolCall] = []
    warnings: list[str] = []
    elapsed_ms: int
