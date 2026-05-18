export interface EmptyStateProps {
  onPick: (message: string) => void
}

interface Suggestion {
  message: string
  tone: 'sql' | 'mongo' | 'rag'
}

const SUGGESTIONS: Suggestion[] = [
  {
    message: 'How many Platinum customers do we have?',
    tone: 'sql',
  },
  {
    message: 'List all open support tickets.',
    tone: 'mongo',
  },
  {
    message: 'What is our pet travel policy?',
    tone: 'rag',
  },
  {
    message:
      'Which flights had the lowest average ratings recently, and what did passengers complain about?',
    tone: 'mongo',
  },
]

const TONE_DOT: Record<Suggestion['tone'], string> = {
  sql: 'bg-sky-400',
  mongo: 'bg-emerald-400',
  rag: 'bg-amber-300',
}

const TONE_LABEL: Record<Suggestion['tone'], string> = {
  sql: 'Postgres',
  mongo: 'Mongo',
  rag: 'pgvector',
}

export function EmptyState({ onPick }: EmptyStateProps) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {SUGGESTIONS.map((s) => (
        <button
          key={s.message}
          type="button"
          onClick={() => onPick(s.message)}
          className="
            group relative flex items-start gap-2.5
            rounded-md border border-[var(--color-line)]
            bg-[var(--color-surface)]
            px-4 py-3 text-left
            transition
            hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-surface-warm)]
            focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/30
          "
        >
          <span
            aria-hidden
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[s.tone]} opacity-70 transition group-hover:opacity-100`}
          />
          <span className="flex-1 text-[13.5px] leading-snug text-[var(--color-text-soft)] transition group-hover:text-[var(--color-text)]">
            {s.message}
          </span>
          <span className="absolute right-3 top-3 hidden font-mono text-[9.5px] uppercase tracking-wider text-[var(--color-muted)] group-hover:inline">
            {TONE_LABEL[s.tone]}
          </span>
        </button>
      ))}
    </div>
  )
}
