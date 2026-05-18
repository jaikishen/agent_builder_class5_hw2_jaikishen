import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

describe('ChatInput', () => {
  it('renders a textarea and a submit button', async () => {
    const { ChatInput } = await import('./ChatInput')
    render(<ChatInput onSubmit={() => {}} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('clicking Send fires onSubmit with trimmed text and clears the textarea', async () => {
    const onSubmit = vi.fn()
    const { ChatInput } = await import('./ChatInput')
    const user = userEvent.setup()
    render(<ChatInput onSubmit={onSubmit} />)

    const textbox = screen.getByRole('textbox') as HTMLTextAreaElement
    await user.type(textbox, '  hello  ')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('hello')
    expect(textbox.value).toBe('')
  })

  it('empty / whitespace input keeps the button disabled and does not fire onSubmit', async () => {
    const onSubmit = vi.fn()
    const { ChatInput } = await import('./ChatInput')
    const user = userEvent.setup()
    render(<ChatInput onSubmit={onSubmit} />)

    const button = screen.getByRole('button', { name: /send/i }) as HTMLButtonElement
    expect(button).toBeDisabled()

    await user.type(screen.getByRole('textbox'), '   ')
    expect(button).toBeDisabled()

    await user.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('Enter submits; Shift+Enter inserts a newline', async () => {
    const onSubmit = vi.fn()
    const { ChatInput } = await import('./ChatInput')
    const user = userEvent.setup()
    render(<ChatInput onSubmit={onSubmit} />)

    const textbox = screen.getByRole('textbox') as HTMLTextAreaElement

    await user.type(textbox, 'first{Enter}')
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('first')
    expect(textbox.value).toBe('')

    await user.type(textbox, 'line1{Shift>}{Enter}{/Shift}line2')
    expect(onSubmit).toHaveBeenCalledTimes(1) // no new submit
    expect(textbox.value).toBe('line1\nline2')
  })

  it('disabled prop disables textarea and button and blocks Enter submit', async () => {
    const onSubmit = vi.fn()
    const { ChatInput } = await import('./ChatInput')
    const user = userEvent.setup()
    render(<ChatInput onSubmit={onSubmit} disabled />)

    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()

    await user.type(screen.getByRole('textbox'), 'hi{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
