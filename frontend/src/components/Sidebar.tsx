import { Plus } from 'lucide-react'

import { Logo } from './Logo'
import { EmptyState } from './EmptyState'

interface SidebarProps {
  onPickExample: (message: string) => void
  onNewConversation: () => void
  showExamples: boolean
}

const SOURCES = [
  { name: 'Policy handbook', badge: 'pgvector' },
  { name: 'Operations DB',   badge: 'Postgres' },
  { name: 'Support data',    badge: 'Mongo' },
]

const TODAY = new Date().toISOString().slice(0, 10)

export function Sidebar({ onPickExample, onNewConversation, showExamples }: SidebarProps) {
  return (
    <aside className="flex w-[300px] shrink-0 flex-col gap-7 border-r border-[var(--color-line)] bg-[var(--color-bg-soft)] px-6 py-7 fade-up">
      {/* Brand block */}
      <div className="flex items-start gap-3">
        <Logo size={34} />
        <div>
          <div className="font-display text-[20px] leading-none tracking-tight text-[var(--color-text)]">
            SkyNova
          </div>
          <div className="eyebrow mt-1.5">Internal AI Agent</div>
        </div>
      </div>

      {/* New conversation */}
      <button
        type="button"
        onClick={onNewConversation}
        className="flex items-center gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-surface-warm)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
      >
        <Plus size={14} strokeWidth={2.25} className="text-[var(--color-brand)]" />
        New conversation
      </button>

      {/* Try asking — example questions (only when nothing's been asked yet) */}
      {showExamples && (
        <div>
          <div className="eyebrow mb-3">Try asking</div>
          <EmptyState onPick={onPickExample} />
        </div>
      )}

      {/* Sources — text-only treatment, no pill badges */}
      <div>
        <div className="eyebrow mb-3">Sources</div>
        <ul className="space-y-2.5">
          {SOURCES.map((s) => (
            <li key={s.name} className="flex items-baseline justify-between">
              <span className="text-[13px] text-[var(--color-text-soft)]">{s.name}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                {s.badge}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Date footer — pushed to the bottom */}
      <div className="mt-auto flex items-baseline justify-between border-t border-[var(--color-line)] pt-4">
        <div className="eyebrow">Today</div>
        <div className="font-mono text-[11px] text-[var(--color-text-soft)]">
          {TODAY}
        </div>
        <div className="eyebrow">v0.1</div>
      </div>
    </aside>
  )
}
