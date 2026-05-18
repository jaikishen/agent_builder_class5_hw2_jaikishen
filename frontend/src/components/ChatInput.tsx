import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'

export interface ChatInputProps {
  onSubmit: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSubmit, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
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
    <form
      onSubmit={handleSubmit}
      className={`
        relative flex flex-col gap-2 rounded-xl border bg-[var(--color-surface)] px-5 py-4
        shadow-[0_1px_0_rgba(255,255,255,0.03),0_24px_48px_-24px_rgba(0,0,0,0.6)]
        transition
        ${focused
          ? 'border-[var(--color-brand)]/50 ring-2 ring-[var(--color-brand)]/15'
          : 'border-[var(--color-line)]'}
      `}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        rows={2}
        placeholder="Type a question — flights, policy, support, all of it…"
        className="w-full resize-none border-0 bg-transparent text-[15.5px] leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none disabled:opacity-50"
      />

      <div className="flex items-end justify-between gap-3 pt-1">
        <div className="flex items-center gap-3 font-mono text-[10.5px] tracking-wider text-[var(--color-muted)]">
          <span>
            <kbd className="rounded border border-[var(--color-line)] bg-[var(--color-bg-soft)] px-1.5 py-px font-mono text-[10px] font-medium text-[var(--color-text-soft)]">
              Enter
            </kbd>{' '}
            <span className="uppercase">to send</span>
          </span>
          <span>
            <kbd className="rounded border border-[var(--color-line)] bg-[var(--color-bg-soft)] px-1.5 py-px font-mono text-[10px] font-medium text-[var(--color-text-soft)]">
              Shift+↵
            </kbd>{' '}
            <span className="uppercase">for newline</span>
          </span>
        </div>

        <button
          type="submit"
          aria-label="Send"
          disabled={!canSubmit}
          className={`
            flex h-9 w-9 items-center justify-center rounded-full transition
            ${canSubmit
              ? 'bg-[var(--color-brand)] text-[var(--color-bg)] hover:bg-[var(--color-brand-soft)] hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/40'
              : 'bg-[var(--color-surface-warm)] text-[var(--color-muted)] cursor-not-allowed'}
          `}
        >
          <ArrowUp size={16} strokeWidth={2.5} />
          <span className="sr-only">Send</span>
        </button>
      </div>
    </form>
  )
}
