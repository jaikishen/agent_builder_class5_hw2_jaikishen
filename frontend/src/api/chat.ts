import type { ChatResponse } from '../types/api'

export class ChatApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Chat API error: ${status}`)
    this.name = 'ChatApiError'
    this.status = status
    this.body = body
  }
}

export async function postChat(
  message: string,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const res = await fetch('/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
    signal,
  })
  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = await res.text().catch(() => '')
    }
    throw new ChatApiError(res.status, body)
  }
  return (await res.json()) as ChatResponse
}
