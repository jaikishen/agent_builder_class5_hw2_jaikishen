import { useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Database,
  Leaf,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { ToolCall } from '../types/api'

export interface ToolCallTraceProps {
  toolCalls: ToolCall[]
  warnings: string[]
  elapsedMs: number
}

const ICONS: Record<string, LucideIcon> = {
  sql_query: Database,
  mongo_query: Leaf,
  handbook_search: BookOpen,
}

function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Wrench
}

function previewFor(call: ToolCall): string {
  const input = call.input ?? {}
  switch (call.tool) {
    case 'sql_query':
      return truncate(String((input as { sql?: unknown }).sql ?? ''), 90)
    case 'mongo_query': {
      const i = input as { collection?: string; operation?: string }
      return `${i.collection ?? ''} · ${i.operation ?? ''}`
    }
    case 'handbook_search':
      return truncate(String((input as { query?: unknown }).query ?? ''), 90)
    default:
      return truncate(JSON.stringify(input), 90)
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function formatElapsed(elapsedMs: number): string {
  return `${(elapsedMs / 1000).toFixed(1)}s`
}

function ToolCard({ call, index }: { call: ToolCall; index: number }) {
  const [open, setOpen] = useState(false)
  const Icon = iconFor(call.tool)
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] transition hover:border-[var(--color-brand)]/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/30"
      >
        <Chevron size={14} className="shrink-0 text-[var(--color-muted)]" />

        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-bg-soft)]">
          <Icon size={13} className="text-[var(--color-brand)]" />
        </span>

        <span className="font-mono text-[10px] tabular-nums tracking-wider text-[var(--color-muted)]">
          {String(index + 1).padStart(2, '0')}
        </span>

        <span className="font-mono text-[12.5px] font-medium text-[var(--color-text)]">
          {call.tool}
        </span>

        <span className="truncate text-[13px] text-[var(--color-text-soft)]">
          — {previewFor(call)}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-[var(--color-line)] px-4 py-3">
          <div>
            <div className="eyebrow mb-1.5">input</div>
            <pre className="overflow-x-auto rounded bg-[var(--color-bg-soft)] p-2.5 font-mono text-[12px] leading-relaxed text-[var(--color-text)]">
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>
          <div>
            <div className="eyebrow mb-1.5">output preview</div>
            <pre className="overflow-x-auto rounded bg-[var(--color-bg-soft)] p-2.5 font-mono text-[12px] leading-relaxed text-[var(--color-text)]">
              {call.output_preview}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export function ToolCallTrace({ toolCalls, warnings, elapsedMs }: ToolCallTraceProps) {
  if (toolCalls.length === 0 && warnings.length === 0) {
    return null
  }

  const plural = toolCalls.length === 1 ? 'tool' : 'tools'

  return (
    <section className="space-y-3" aria-label="Tool call trace">
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div
              key={`${w}-${i}`}
              role="alert"
              className="flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[13px] text-amber-200"
            >
              <AlertTriangle size={15} className="shrink-0" />
              <span className="font-mono text-[11.5px]">{w}</span>
            </div>
          ))}
        </div>
      )}

      {toolCalls.length > 0 && (
        <>
          <div className="flex items-baseline justify-between">
            <div className="eyebrow">Reasoning trail</div>
            <div className="font-mono text-[11.5px] text-[var(--color-text-soft)]">
              <span className="tabular-nums">{formatElapsed(elapsedMs)}</span>
              <span className="mx-1.5 text-[var(--color-muted)]">·</span>
              <span>
                {toolCalls.length} {plural} fired
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {toolCalls.map((call, i) => (
              <ToolCard key={`${call.tool}-${i}`} call={call} index={i} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
