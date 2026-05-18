import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

describe('EmptyState', () => {
  it('renders example chips and clicking fires onPick with a non-empty message', async () => {
    const onPick = vi.fn()
    const { EmptyState } = await import('./EmptyState')
    const user = userEvent.setup()
    render(<EmptyState onPick={onPick} />)

    const chips = screen.getAllByRole('button')
    expect(chips.length).toBeGreaterThanOrEqual(4)

    // At least one chip per tool family is represented in the labels.
    const labels = chips.map((b) => b.textContent ?? '').join('|').toLowerCase()
    expect(labels).toMatch(/platinum/) // sql_query
    expect(labels).toMatch(/support tickets/) // mongo_query
    expect(labels).toMatch(/pet/) // handbook_search

    // Click the first chip — onPick fires once with a non-empty message
    // (label and message may differ: the chip shows a short label,
    // but the message sent to the agent is the full question).
    await user.click(chips[0])
    expect(onPick).toHaveBeenCalledTimes(1)
    const sent = onPick.mock.calls[0][0]
    expect(typeof sent).toBe('string')
    expect(sent.length).toBeGreaterThan(0)
  })
})
