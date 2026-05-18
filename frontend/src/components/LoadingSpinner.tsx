import { Loader2 } from 'lucide-react'

export function LoadingSpinner() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex items-center justify-center gap-3 py-12 fade-up"
    >
      <Loader2 size={18} className="animate-spin text-[var(--color-brand)]" />
      <span className="font-display text-[15px] italic text-[var(--color-text-soft)]">
        Thinking…
      </span>
    </div>
  )
}
