import { useCallback, useRef, useState } from 'react'

import { postChat } from '../api/chat'
import type { ChatResponse } from '../types/api'

export type ChatState = 'idle' | 'loading' | 'success' | 'error'

export interface UseChat {
  state: ChatState
  response: ChatResponse | null
  error: Error | null
  send: (message: string) => void
  reset: () => void
}

export function useChat(): UseChat {
  const [state, setState] = useState<ChatState>('idle')
  const [response, setResponse] = useState<ChatResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback((message: string) => {
    // Abort any in-flight request so its (stale) response can't overwrite ours.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState('loading')
    setResponse(null)
    setError(null)

    postChat(message, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return
        setResponse(res)
        setState('success')
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setState('error')
      })
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState('idle')
    setResponse(null)
    setError(null)
  }, [])

  return { state, response, error, send, reset }
}
