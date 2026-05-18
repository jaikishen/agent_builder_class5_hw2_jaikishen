import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'

import App from './App'

describe('App (Phase F1 wiring)', () => {
  it('renders the SkyNova heading and a chat input', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /SkyNova Airlines Agent/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('shows the raw JSON envelope after a successful submit', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('textbox'), 'hi{Enter}')

    await waitFor(() => {
      // The raw JSON viewer is the only <pre>; it should contain the echo payload.
      const pre = document.querySelector('pre')
      expect(pre).not.toBeNull()
      expect(pre!.textContent).toContain('"answer"')
      expect(pre!.textContent).toContain('echo: hi')
    })
  })
})
