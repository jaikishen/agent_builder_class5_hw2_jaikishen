import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

describe('LoadingSpinner', () => {
  it('renders a spinner with status role and a label', async () => {
    const { LoadingSpinner } = await import('./LoadingSpinner')
    const { container } = render(<LoadingSpinner />)

    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveTextContent(/thinking/i)

    // Lucide Loader2 produces a .lucide-loader-circle (or similar) — be lax.
    expect(container.querySelector('svg')).not.toBeNull()
    // Animation class.
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })
})
