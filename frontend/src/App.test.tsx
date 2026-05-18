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

  it('renders the answer text after a successful submit (not raw JSON)', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('textbox'), 'hi{Enter}')

    // Answer text appears as rendered markdown, not inside a JSON <pre>.
    await waitFor(() => {
      expect(screen.getByText(/echo: hi/)).toBeInTheDocument()
    })

    // No <pre> wrapping a serialized envelope (no `"answer":` substring anywhere
    // in a pre tag). Fenced code blocks inside a real answer would still be
    // allowed; this just rules out the F1 raw-JSON viewer.
    const pres = document.querySelectorAll('pre')
    for (const pre of pres) {
      expect(pre.textContent ?? '').not.toContain('"answer":')
    }
  })
})
