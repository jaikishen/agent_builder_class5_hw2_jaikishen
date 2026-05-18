import { Loader2 } from 'lucide-react'

export function LoadingSpinner() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex items-center justify-center gap-2 py-6 text-muted"
    >
      <Loader2 size={20} className="animate-spin text-brand" />
      <span className="text-sm">Thinking…</span>
    </div>
  )
}
