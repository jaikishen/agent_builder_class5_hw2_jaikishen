import { useCallback, useRef, useState } from 'react'

import { postChat } from '../api/chat'
import type { ChatMessage, ChatResponse } from '../types/api'

export type ChatState = 'idle' | 'loading' | 'success' | 'error'

export interface Turn {
  id: string
  question: string
  state: 'loading' | 'success' | 'error'
  response: ChatResponse | null
  error: Error | null
}

export interface UseChat {
  turns: Turn[]
  send: (message: string) => void
  retry: () => void
  reset: () => void

  // Backward-compatible single-turn view (derived from the latest turn).
  state: ChatState
  response: ChatResponse | null
  error: Error | null
  question: string | null
}

let nextId = 0
const newId = () => `t-${++nextId}`

function buildHistoryFromTurns(turns: Turn[]): ChatMessage[] {
  const out: ChatMessage[] = []
  for (const t of turns) {
    if (t.state === 'success' && t.response) {
      out.push({ role: 'user', content: t.question })
      out.push({ role: 'assistant', content: t.response.answer })
    }
  }
  return out
}

export function useChat(): UseChat {
  const [turns, setTurns] = useState<Turn[]>([])
  const abortRef = useRef<AbortController | null>(null)
  // Mirror turns into a ref so `send` can keep a stable identity AND
  // still read the latest history when it's called.
  const turnsRef = useRef<Turn[]>(turns)
  turnsRef.current = turns

  const send = useCallback((message: string) => {
    // Abort any in-flight request and drop still-loading turns.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const turn: Turn = {
      id: newId(),
      question: message,
      state: 'loading',
      response: null,
      error: null,
    }

    // History = all prior successful Q&A pairs, in order.
    const history = buildHistoryFromTurns(turnsRef.current)

    setTurns((prev) => [
      ...prev.filter((t) => t.state !== 'loading'),
      turn,
    ])

    postChat(message, controller.signal, history)
      .then((res) => {
        if (controller.signal.aborted) return
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turn.id
              ? { ...t, state: 'success', response: res, error: null }
              : t,
          ),
        )
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const wrapped = err instanceof Error ? err : new Error(String(err))
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turn.id
              ? { ...t, state: 'error', response: null, error: wrapped }
              : t,
          ),
        )
      })
  }, [])

  const retry = useCallback(() => {
    const last = turnsRef.current[turnsRef.current.length - 1]
    if (!last) return
    // Drop the last turn (typically the failed one) so the retry replaces it
    // rather than appearing as a duplicate question in the history.
    setTurns((prev) => prev.slice(0, -1))
    send(last.question)
  }, [send])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setTurns([])
  }, [])

  // Derived single-turn view for callers / tests that haven't migrated.
  const last = turns[turns.length - 1]
  const state: ChatState = last?.state ?? 'idle'
  const response = last?.state === 'success' ? last.response : null
  const error = last?.state === 'error' ? last.error : null
  const question = last?.question ?? null

  return { turns, send, retry, reset, state, response, error, question }
}
