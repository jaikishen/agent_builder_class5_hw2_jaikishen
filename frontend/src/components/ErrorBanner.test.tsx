import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

describe('ErrorBanner', () => {
  it('renders the message and the Retry button fires onRetry', async () => {
    const onRetry = vi.fn()
    const { ErrorBanner } = await import('./ErrorBanner')
    const user = userEvent.setup()
    render(<ErrorBanner message="Chat API error: 500" onRetry={onRetry} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Chat API error: 500')

    const retry = screen.getByRole('button', { name: /retry/i })
    await user.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
