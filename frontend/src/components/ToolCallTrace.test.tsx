import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'

import type { ToolCall } from '../types/api'

function sqlCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    tool: 'sql_query',
    input: { sql: "SELECT COUNT(*) FROM customers WHERE loyalty_tier = 'Platinum'" },
    output_preview: '{"rows":[{"count":4}],"truncated":false,"shown":1,"total":1}',
    ...overrides,
  }
}

function mongoCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    tool: 'mongo_query',
    input: { collection: 'support_tickets', operation: 'find', filter: { status: 'Open' } },
    output_preview: '{"rows":[{"ticket_id":"TCK-1"}],"truncated":false,"shown":1,"total":1}',
    ...overrides,
  }
}

function handbookCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    tool: 'handbook_search',
    input: { query: 'pet travel policy', k: 3 },
    output_preview: '{"rows":[{"content":"Pets in cabin ...","section":"4.2","similarity":0.85}]}',
    ...overrides,
  }
}

describe('ToolCallTrace', () => {
  it('renders nothing when toolCalls and warnings are both empty', async () => {
    const { ToolCallTrace } = await import('./ToolCallTrace')
    const { container } = render(
      <ToolCallTrace toolCalls={[]} warnings={[]} elapsedMs={0} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders one card per tool call with the tool name visible', async () => {
    const { ToolCallTrace } = await import('./ToolCallTrace')
    render(
      <ToolCallTrace
        toolCalls={[sqlCall(), mongoCall()]}
        warnings={[]}
        elapsedMs={1200}
      />,
    )
    expect(screen.getAllByText('sql_query')).toHaveLength(1)
    expect(screen.getAllByText('mongo_query')).toHaveLength(1)
  })

  it('header strip shows elapsed time and pluralizes tool count', async () => {
    const { ToolCallTrace } = await import('./ToolCallTrace')

    const { rerender } = render(
      <ToolCallTrace toolCalls={[sqlCall()]} warnings={[]} elapsedMs={4037} />,
    )
    expect(screen.getByText(/4\.0\s*s/)).toBeInTheDocument()
    expect(screen.getByText(/1 tool fired/)).toBeInTheDocument()

    rerender(
      <ToolCallTrace
        toolCalls={[sqlCall(), mongoCall(), handbookCall()]}
        warnings={[]}
        elapsedMs={12500}
      />,
    )
    expect(screen.getByText(/12\.5\s*s/)).toBeInTheDocument()
    expect(screen.getByText(/3 tools fired/)).toBeInTheDocument()
  })

  it('header preview is tool-aware', async () => {
    const { ToolCallTrace } = await import('./ToolCallTrace')
    render(
      <ToolCallTrace
        toolCalls={[sqlCall(), mongoCall(), handbookCall()]}
        warnings={[]}
        elapsedMs={1}
      />,
    )
    // sql_query → snippet of the SQL
    expect(
      screen.getByText(/SELECT COUNT\(\*\) FROM customers/),
    ).toBeInTheDocument()
    // mongo_query → "collection · operation"
    expect(screen.getByText(/support_tickets\s*·\s*find/)).toBeInTheDocument()
    // handbook_search → the query string
    expect(screen.getByText(/pet travel policy/)).toBeInTheDocument()
  })

  it('clicking a card expands its body and toggles back on a second click', async () => {
    const { ToolCallTrace } = await import('./ToolCallTrace')
    const user = userEvent.setup()
    render(
      <ToolCallTrace toolCalls={[sqlCall()]} warnings={[]} elapsedMs={1} />,
    )

    // Collapsed initially — output_preview text is not visible.
    expect(screen.queryByText(/"count":4/)).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: /sql_query/i })
    await user.click(trigger)
    expect(screen.getByText(/"count":4/)).toBeInTheDocument()

    await user.click(trigger)
    expect(screen.queryByText(/"count":4/)).not.toBeInTheDocument()
  })

  it('expanded card body renders input and output_preview blocks', async () => {
    const { ToolCallTrace } = await import('./ToolCallTrace')
    const user = userEvent.setup()
    const { container } = render(
      <ToolCallTrace toolCalls={[sqlCall()]} warnings={[]} elapsedMs={1} />,
    )

    await user.click(screen.getByRole('button', { name: /sql_query/i }))

    const pres = container.querySelectorAll('pre')
    // One pre for input, one for output_preview.
    expect(pres.length).toBeGreaterThanOrEqual(2)
    const all = Array.from(pres, (p) => p.textContent ?? '').join('\n')
    expect(all).toContain('sql') // input contains the "sql" key
    expect(all).toContain('SELECT COUNT(*) FROM customers')
    expect(all).toContain('"count":4') // output_preview verbatim
  })

  it.each([
    ['sql_query', 'lucide-database'],
    ['mongo_query', 'lucide-leaf'],
    ['handbook_search', 'lucide-book-open'],
    ['unknown_tool', 'lucide-wrench'],
  ])('renders the right lucide icon for %s', async (toolName, iconClass) => {
    const { ToolCallTrace } = await import('./ToolCallTrace')
    const call: ToolCall = {
      tool: toolName,
      input: {},
      output_preview: '{}',
    }
    const { container } = render(
      <ToolCallTrace toolCalls={[call]} warnings={[]} elapsedMs={1} />,
    )
    expect(container.querySelector(`.${iconClass}`)).not.toBeNull()
  })

  it('renders a warning banner for each warning', async () => {
    const { ToolCallTrace } = await import('./ToolCallTrace')
    render(
      <ToolCallTrace
        toolCalls={[]}
        warnings={['max_iterations_reached', 'something_else']}
        elapsedMs={0}
      />,
    )
    expect(screen.getByText('max_iterations_reached')).toBeInTheDocument()
    expect(screen.getByText('something_else')).toBeInTheDocument()
  })
})
