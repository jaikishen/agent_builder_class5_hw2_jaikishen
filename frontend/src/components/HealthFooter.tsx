import { useEffect, useState } from 'react'

type HealthState = 'pending' | 'ok' | 'offline'

export function HealthFooter() {
  const [status, setStatus] = useState<HealthState>('pending')

  useEffect(() => {
    let cancelled = false
    fetch('/health')
      .then((r) => {
        if (cancelled) return
        setStatus(r.ok ? 'ok' : 'offline')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('offline')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const { dotStyle, label } = (() => {
    switch (status) {
      case 'ok':
        return { dotStyle: 'bg-[var(--color-brand)]', label: 'Connected' }
      case 'offline':
        return { dotStyle: 'bg-red-500', label: 'Backend offline' }
      default:
        return { dotStyle: 'bg-[var(--color-muted)]', label: 'Checking…' }
    }
  })()

  return (
    <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider text-[var(--color-muted)]">
      <span
        className={`relative inline-block h-1.5 w-1.5 rounded-full ${dotStyle}`}
        aria-hidden
      >
        {status === 'ok' && (
          <span className="absolute inset-0 animate-ping rounded-full bg-[var(--color-brand)] opacity-50" />
        )}
      </span>
      <span>{label}</span>
    </div>
  )
}
