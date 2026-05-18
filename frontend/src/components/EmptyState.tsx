export interface EmptyStateProps {
  onPick: (message: string) => void
}

const EXAMPLE_QUESTIONS: string[] = [
  'How many Platinum customers do we have?',
  'List all open support tickets.',
  'What is our pet travel policy?',
  'For SN301, who was affected, what is our cancellation policy, and what did the affected passengers say?',
]

export function EmptyState({ onPick }: EmptyStateProps) {
  return (
    <div className="space-y-3">
      <div className="text-center text-sm text-muted">
        Try one of these to see the agent route across tools:
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-full border border-white/10 bg-surface px-3 py-1.5 text-sm text-text hover:border-brand/60 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
