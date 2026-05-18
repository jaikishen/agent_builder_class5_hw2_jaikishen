import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

describe('EmptyState', () => {
  it('renders example chips and clicking fires onPick with the chip text', async () => {
    const onPick = vi.fn()
    const { EmptyState } = await import('./EmptyState')
    const user = userEvent.setup()
    render(<EmptyState onPick={onPick} />)

    // We expect at least 4 chips, covering the three tools + one multi-tool.
    const chips = screen.getAllByRole('button')
    expect(chips.length).toBeGreaterThanOrEqual(4)

    // At least one chip per tool family — keyword-spot the canonical examples.
    const labels = chips.map((b) => b.textContent ?? '').join('|').toLowerCase()
    expect(labels).toMatch(/platinum/) // sql_query
    expect(labels).toMatch(/support tickets/) // mongo_query
    expect(labels).toMatch(/pet/) // handbook_search

    // Click the first chip — onPick fires once with that chip's text.
    const first = chips[0]
    const expected = first.textContent ?? ''
    await user.click(first)
    expect(onPick).toHaveBeenCalledExactlyOnceWith(expected)
  })
})
