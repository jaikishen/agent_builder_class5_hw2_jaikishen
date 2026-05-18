import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

import type { ChatResponse } from '../types/api'

// Default handler — a happy 200 echo. Individual tests override via server.use(...).
const defaultChatResponse: ChatResponse = {
  answer: 'echo: hi',
  tool_calls: [],
  warnings: [],
  elapsed_ms: 42,
}

export const handlers = [
  http.post('*/chat', async ({ request }) => {
    const body = (await request.json()) as { message?: string }
    return HttpResponse.json({
      ...defaultChatResponse,
      answer: `echo: ${body?.message ?? ''}`,
    })
  }),
  // Default /health handler so App tests that mount the whole shell don't
  // explode on the HealthFooter's auto-fetch. Individual tests override.
  http.get('*/health', () => HttpResponse.json({ ok: true })),
]

export const server = setupServer(...handlers)
