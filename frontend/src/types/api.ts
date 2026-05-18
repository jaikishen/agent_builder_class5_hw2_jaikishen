// Mirrors backend/schemas.py — keep in sync when the API contract changes.

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  message: string
  history?: ChatMessage[]
}

export interface ToolCall {
  tool: string
  input: Record<string, unknown>
  output_preview: string
}

export interface ChatResponse {
  answer: string
  tool_calls: ToolCall[]
  warnings: string[]
  elapsed_ms: number
}
