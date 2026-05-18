import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import App from './App'

describe('App (Phase F0 smoke)', () => {
  it('renders the SkyNova hero heading', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /SkyNova Airlines Agent/i }),
    ).toBeInTheDocument()
  })
})
