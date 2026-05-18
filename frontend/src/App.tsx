import { useEffect, useRef } from 'react'
import { RotateCcw } from 'lucide-react'

import { ChatInput } from './components/ChatInput'
import { EmptyState } from './components/EmptyState'
import { HealthFooter } from './components/HealthFooter'
import { Hero } from './components/Hero'
import { Logo } from './components/Logo'
import { TurnView } from './components/TurnView'
import { useChat } from './hooks/useChat'

function App() {
  const { turns, send, retry, reset } = useChat()
  const scrollRef = useRef<HTMLDivElement>(null)

  const showEmptyState = turns.length === 0
  const isLoading = turns.some((t) => t.state === 'loading')

  // Auto-scroll the conversation column to the bottom whenever anything
  // in the turns array changes (new question, new answer, retry, etc.).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [turns])

  return (
    <>
      {/* Accessible heading (visually hidden) — tests rely on this text. */}
      <h1 className="sr-only">SkyNova Airlines Agent</h1>

      <div className="relative z-10 flex h-screen flex-col">
        {/* Top bar — brand left, status + reset right */}
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-line)] px-8 py-4 fade-up">
          <div className="flex items-center gap-3">
            <Logo size={28} />
            <div className="leading-tight">
              <div className="font-display text-[17px] tracking-tight text-[var(--color-text)]">
                SkyNova
              </div>
              <div className="eyebrow mt-0.5">SkyNova Assistant</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <HealthFooter />
            {!showEmptyState && (
              <>
                <div className="h-4 w-px bg-[var(--color-line)]" />
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wider text-[var(--color-text-soft)] transition hover:border-[var(--color-brand)]/40 hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
                >
                  <RotateCcw size={11} strokeWidth={2.25} />
                  New conversation
                </button>
              </>
            )}
          </div>
        </header>

        {/* Conversation area — scrollable column with auto-scroll-to-bottom.
            Empty state shows the Hero centered; otherwise the turns list. */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-8 py-10">
            {showEmptyState ? (
              <div className="flex flex-1 items-center justify-center">
                <Hero />
              </div>
            ) : (
              <div
                aria-live="polite"
                className="space-y-12"
              >
                {turns.map((turn) => (
                  <TurnView key={turn.id} turn={turn} onRetry={retry} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Composer area — suggestion chips above (empty state only), composer, caption */}
        <div className="shrink-0 border-t border-[var(--color-line)] bg-[var(--color-bg)] px-8 pt-5 pb-6">
          <div className="mx-auto w-full max-w-3xl space-y-3">
            {showEmptyState && <EmptyState onPick={send} />}
            <ChatInput onSubmit={send} disabled={isLoading} />
            <p className="text-center font-mono text-[10.5px] uppercase tracking-wider text-[var(--color-muted)]">
              Read-only · multi-turn history is browser-side · trace included with every answer
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
