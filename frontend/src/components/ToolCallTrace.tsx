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
      return truncate(String((input as { sql?: unknown }).sql ?? ''), 80)
    case 'mongo_query': {
      const i = input as { collection?: string; operation?: string }
      return `${i.collection ?? ''} · ${i.operation ?? ''}`
    }
    case 'handbook_search':
      return truncate(String((input as { query?: unknown }).query ?? ''), 80)
    default:
      return truncate(JSON.stringify(input), 80)
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function formatElapsed(elapsedMs: number): string {
  return `${(elapsedMs / 1000).toFixed(1)}s`
}

function ToolCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false)
  const Icon = iconFor(call.tool)
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <div className="rounded-md border border-white/10 bg-surface/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left font-mono text-sm hover:bg-surface/60"
      >
        <Chevron size={14} className="shrink-0 text-muted" />
        <Icon size={16} className="shrink-0 text-brand" />
        <span className="shrink-0 font-semibold text-text">{call.tool}</span>
        <span className="truncate text-muted">— {previewFor(call)}</span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-white/10 px-3 py-3">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-muted">
              input
            </div>
            <pre className="overflow-x-auto rounded bg-surface p-2 font-mono text-xs text-text">
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-muted">
              output_preview
            </div>
            <pre className="overflow-x-auto rounded bg-surface p-2 font-mono text-xs text-text">
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
              className="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200"
            >
              <AlertTriangle size={16} className="shrink-0" />
              <span className="font-mono">{w}</span>
            </div>
          ))}
        </div>
      )}

      {toolCalls.length > 0 && (
        <>
          <div className="text-xs text-muted">
            {formatElapsed(elapsedMs)} · {toolCalls.length} {plural} fired
          </div>
          <div className="space-y-2">
            {toolCalls.map((call, i) => (
              <ToolCard key={`${call.tool}-${i}`} call={call} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
