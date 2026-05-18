import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'

export interface ChatInputProps {
  onSubmit: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSubmit, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('')
  const trimmed = text.trim()
  const canSubmit = !disabled && trimmed.length > 0

  function trySubmit() {
    if (!canSubmit) return
    onSubmit(trimmed)
    setText('')
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    trySubmit()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      trySubmit()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={2}
        placeholder="Ask SkyNova anything…"
        className="flex-1 resize-none rounded-md border border-white/10 bg-surface px-3 py-2 font-sans text-text placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      <button
        type="submit"
        disabled={!canSubmit}
        className="flex items-center gap-2 self-stretch rounded-md bg-brand px-4 font-medium text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Send size={16} />
        Send
      </button>
    </form>
  )
}
