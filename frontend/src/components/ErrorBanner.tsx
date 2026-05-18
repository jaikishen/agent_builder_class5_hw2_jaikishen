import { AlertCircle, RotateCw } from 'lucide-react'

export interface ErrorBannerProps {
  message: string
  onRetry: () => void
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="font-medium">Something went wrong</div>
        <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-red-300">
          {message}
        </pre>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1 self-start rounded-md border border-red-500/40 px-3 py-1 text-xs text-red-100 hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-400/50"
      >
        <RotateCw size={14} />
        Retry
      </button>
    </div>
  )
}
