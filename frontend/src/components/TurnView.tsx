import { AnswerDisplay } from './AnswerDisplay'
import { ErrorBanner } from './ErrorBanner'
import { LoadingSpinner } from './LoadingSpinner'
import { ToolCallTrace } from './ToolCallTrace'
import type { Turn } from '../hooks/useChat'

interface TurnViewProps {
  turn: Turn
  onRetry: () => void
}

export function TurnView({ turn, onRetry }: TurnViewProps) {
  return (
    <div className="flex flex-col gap-5 fade-up">
      {/* The user's question — plain, prominent, no label */}
      <p className="font-sans text-[17px] font-medium leading-snug text-[var(--color-text)]">
        {turn.question}
      </p>

      {turn.state === 'loading' && <LoadingSpinner />}

      {turn.state === 'error' && turn.error && (
        <ErrorBanner message={turn.error.message} onRetry={onRetry} />
      )}

      {turn.state === 'success' && turn.response && (
        <div className="flex flex-col gap-5">
          <ToolCallTrace
            toolCalls={turn.response.tool_calls}
            warnings={turn.response.warnings}
            elapsedMs={turn.response.elapsed_ms}
          />
          <article className="rounded-md border border-[var(--color-line)] bg-[var(--color-bg-soft)] p-6">
            <AnswerDisplay markdown={turn.response.answer} />
          </article>
        </div>
      )}
    </div>
  )
}
