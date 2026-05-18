import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, it, expect } from 'vitest'

import { server } from '../test/server'

describe('HealthFooter', () => {
  it('shows connected when /health returns ok', async () => {
    server.use(
      http.get('*/health', () => HttpResponse.json({ ok: true })),
    )
    const { HealthFooter } = await import('./HealthFooter')
    render(<HealthFooter />)

    await waitFor(() =>
      expect(screen.getByText(/connected/i)).toBeInTheDocument(),
    )
  })

  it('shows offline when /health fails', async () => {
    server.use(
      http.get('*/health', () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    )
    const { HealthFooter } = await import('./HealthFooter')
    render(<HealthFooter />)

    await waitFor(() =>
      expect(screen.getByText(/offline/i)).toBeInTheDocument(),
    )
  })
})
