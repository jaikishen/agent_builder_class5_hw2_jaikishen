export interface EmptyStateProps {
  onPick: (message: string) => void
}

const EXAMPLE_QUESTIONS: string[] = [
  'Customer 3 complained about flight SN401. What is our delay compensation policy, what did they actually fly, and what is the ticket status?',
  'For SN301, who was affected, what is our cancellation policy, and what did the affected passengers say?',
  'How much has Aarav Mehta spent with us this year, what tier is he, and what miles bonus should his Business class trip have earned per the program?',
  'Which flights had the lowest average ratings recently, and what did passengers complain about?',
  'How many Platinum customers do we have?',
  'List all open support tickets.',
  'What is our pet travel policy?',
]

export function EmptyState({ onPick }: EmptyStateProps) {
  return (
    <ul className="space-y-3 text-[13px] leading-snug text-[var(--color-text-soft)]">
      {EXAMPLE_QUESTIONS.map((q) => (
        <li key={q} className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--color-brand)]/60"
          />
          <button
            type="button"
            onClick={() => onPick(q)}
            className="line-clamp-3 text-left transition hover:text-[var(--color-text)] hover:decoration-[var(--color-brand)] hover:underline hover:underline-offset-2 focus:outline-none focus-visible:text-[var(--color-text)] focus-visible:underline focus-visible:decoration-[var(--color-brand)] focus-visible:underline-offset-2"
          >
            {q}
          </button>
        </li>
      ))}
    </ul>
  )
}
