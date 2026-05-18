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

  const { dotClass, label } = (() => {
    switch (status) {
      case 'ok':
        return { dotClass: 'bg-brand', label: 'Connected' }
      case 'offline':
        return { dotClass: 'bg-red-500', label: 'Backend offline' }
      default:
        return { dotClass: 'bg-muted', label: 'Checking…' }
    }
  })()

  return (
    <footer className="mt-8 flex items-center justify-center gap-2 text-xs text-muted">
      <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
      <span>{label}</span>
    </footer>
  )
}
