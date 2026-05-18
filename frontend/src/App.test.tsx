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

  it('renders tool trace alongside the answer when the response includes tool_calls', async () => {
    const { http, HttpResponse } = await import('msw')
    const { server } = await import('./test/server')
    server.use(
      http.post('*/chat', () =>
        HttpResponse.json({
          answer: 'We have 4 Platinum customers.',
          tool_calls: [
            {
              tool: 'sql_query',
              input: { sql: "SELECT COUNT(*) FROM customers WHERE loyalty_tier = 'Platinum'" },
              output_preview: '{"rows":[{"count":4}],"truncated":false,"shown":1,"total":1}',
            },
          ],
          warnings: [],
          elapsed_ms: 3142,
        }),
      ),
    )

    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('textbox'), 'how many platinum{Enter}')

    await waitFor(() => {
      expect(screen.getByText(/We have 4 Platinum customers/)).toBeInTheDocument()
    })
    // Tool trace header strip is rendered.
    expect(screen.getByText(/3\.1\s*s/)).toBeInTheDocument()
    expect(screen.getByText(/1 tool fired/)).toBeInTheDocument()
    // Card header text mentions sql_query.
    expect(screen.getByRole('button', { name: /sql_query/i })).toBeInTheDocument()
  })
})
