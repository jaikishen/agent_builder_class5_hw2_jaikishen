import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse, delay } from 'msw'
import { describe, it, expect } from 'vitest'

import { server } from '../test/server'

describe('useChat', () => {
  it('starts in idle with no response or error', async () => {
    const { useChat } = await import('./useChat')
    const { result } = renderHook(() => useChat())
    expect(result.current.state).toBe('idle')
    expect(result.current.response).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('send() transitions idle → loading → success and stores the response', async () => {
    const { useChat } = await import('./useChat')
    const { result } = renderHook(() => useChat())

    act(() => {
      result.current.send('hi')
    })
    expect(result.current.state).toBe('loading')

    await waitFor(() => expect(result.current.state).toBe('success'))
    expect(result.current.response?.answer).toBe('echo: hi')
    expect(result.current.error).toBeNull()
  })

  it('send() transitions idle → loading → error on 500', async () => {
    server.use(
      http.post('*/chat', () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    )
    const { useChat } = await import('./useChat')
    const { ChatApiError } = await import('../api/chat')

    const { result } = renderHook(() => useChat())
    act(() => {
      result.current.send('please-fail')
    })

    await waitFor(() => expect(result.current.state).toBe('error'))
    expect(result.current.response).toBeNull()
    expect(result.current.error).toBeInstanceOf(ChatApiError)
  })

  it('concurrent send() aborts the prior request — fresh response wins', async () => {
    let callCount = 0
    server.use(
      http.post('*/chat', async ({ request }) => {
        callCount += 1
        const body = (await request.json()) as { message: string }
        // First call slow, subsequent fast — proves the abort happened.
        if (callCount === 1) await delay(200)
        else await delay(5)
        return HttpResponse.json({
          answer: `echo: ${body.message}`,
          tool_calls: [], warnings: [], elapsed_ms: 1,
        })
      }),
    )
    const { useChat } = await import('./useChat')
    const { result } = renderHook(() => useChat())

    act(() => { result.current.send('first') })
    act(() => { result.current.send('second') })

    await waitFor(() => expect(result.current.state).toBe('success'))
    expect(result.current.response?.answer).toBe('echo: second')
  })

  it('reset() returns the hook to idle', async () => {
    const { useChat } = await import('./useChat')
    const { result } = renderHook(() => useChat())

    act(() => { result.current.send('hi') })
    await waitFor(() => expect(result.current.state).toBe('success'))

    act(() => { result.current.reset() })
    expect(result.current.state).toBe('idle')
    expect(result.current.response).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('retry() re-sends the previous message', async () => {
    const { useChat } = await import('./useChat')
    const { result } = renderHook(() => useChat())

    act(() => { result.current.send('alpha') })
    await waitFor(() => expect(result.current.state).toBe('success'))
    expect(result.current.response?.answer).toBe('echo: alpha')

    act(() => { result.current.retry() })
    expect(result.current.state).toBe('loading')

    await waitFor(() => expect(result.current.state).toBe('success'))
    expect(result.current.response?.answer).toBe('echo: alpha')
  })

  it('retry() is a no-op when nothing has been sent', async () => {
    const { useChat } = await import('./useChat')
    const { result } = renderHook(() => useChat())

    act(() => { result.current.retry() })
    expect(result.current.state).toBe('idle')
    expect(result.current.response).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('reset() clears lastMessage so retry is a no-op afterward', async () => {
    const { useChat } = await import('./useChat')
    const { result } = renderHook(() => useChat())

    act(() => { result.current.send('alpha') })
    await waitFor(() => expect(result.current.state).toBe('success'))

    act(() => { result.current.reset() })
    act(() => { result.current.retry() })
    expect(result.current.state).toBe('idle')
    expect(result.current.response).toBeNull()
  })
})
