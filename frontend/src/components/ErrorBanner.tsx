import { AlertCircle, RotateCw } from 'lucide-react'

export interface ErrorBannerProps {
  message: string
  onRetry: () => void
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-red-500/30 bg-red-500/[0.08] p-4 text-[14px] text-[var(--color-text)] fade-up"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-400" />
      <div className="flex-1">
        <div className="font-display text-[16px] font-medium leading-tight text-[var(--color-text)]">
          Something went wrong
        </div>
        <pre className="mt-1.5 whitespace-pre-wrap break-words font-mono text-[12px] text-[var(--color-text-soft)]">
          {message}
        </pre>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 self-start rounded-md border border-red-500/40 bg-[var(--color-surface)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-red-300 transition hover:border-red-400 hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/30"
      >
        <RotateCw size={12} strokeWidth={2.25} />
        Retry
      </button>
    </div>
  )
}
