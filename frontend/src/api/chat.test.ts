import { http, HttpResponse, delay } from 'msw'
import { describe, it, expect } from 'vitest'

import { server } from '../test/server'

describe('postChat', () => {
  it('returns ChatResponse on 200', async () => {
    const { postChat } = await import('./chat')
    const result = await postChat('hi')
    expect(result.answer).toBe('echo: hi')
    expect(result.tool_calls).toEqual([])
    expect(result.warnings).toEqual([])
    expect(typeof result.elapsed_ms).toBe('number')
  })

  it('throws ChatApiError on 500 with parsed body', async () => {
    server.use(
      http.post('*/chat', () =>
        HttpResponse.json(
          { error: 'internal_server_error', request_id: 'r-1' },
          { status: 500 },
        ),
      ),
    )
    const { postChat, ChatApiError } = await import('./chat')

    await expect(postChat('boom')).rejects.toMatchObject({
      name: 'ChatApiError',
      status: 500,
    })
    // Re-throw + introspect the body too.
    try {
      await postChat('boom')
      throw new Error('should not reach here')
    } catch (err) {
      expect(err).toBeInstanceOf(ChatApiError)
      expect((err as InstanceType<typeof ChatApiError>).body).toMatchObject({
        request_id: 'r-1',
      })
    }
  })

  it('aborts when signal is aborted mid-flight', async () => {
    server.use(
      http.post('*/chat', async () => {
        await delay(200)
        return HttpResponse.json({
          answer: 'late', tool_calls: [], warnings: [], elapsed_ms: 200,
        })
      }),
    )
    const { postChat } = await import('./chat')

    const controller = new AbortController()
    const promise = postChat('slow', controller.signal)
    setTimeout(() => controller.abort(), 10)

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })
})
