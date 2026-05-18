import { render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

async function renderMarkdown(markdown: string) {
  const { AnswerDisplay } = await import('./AnswerDisplay')
  return render(<AnswerDisplay markdown={markdown} />)
}

describe('AnswerDisplay', () => {
  it('renders plain prose', async () => {
    await renderMarkdown('Hello world')
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders an unordered list with <ul> and <li>s', async () => {
    await renderMarkdown('- one\n- two')
    const list = screen.getByRole('list')
    expect(list.tagName).toBe('UL')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('one')
    expect(items[1]).toHaveTextContent('two')
  })

  it('renders inline code with brand styling', async () => {
    const { container } = await renderMarkdown('use `foo` here')
    const code = container.querySelector('code')
    expect(code).not.toBeNull()
    expect(code).toHaveTextContent('foo')
    // The inline override gives the chip its surface background.
    expect(code).toHaveClass('bg-surface')
  })

  it('renders a fenced code block', async () => {
    const { container } = await renderMarkdown('```js\nSELECT 1\n```')
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    const innerCode = pre!.querySelector('code')
    expect(innerCode).not.toBeNull()
    expect(innerCode!.className).toMatch(/language-/)
    expect(innerCode).toHaveTextContent('SELECT 1')
  })

  it('renders a GFM pipe table via remark-gfm', async () => {
    await renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |')
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'A' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument()
  })

  it('renders an h2 heading with brand color', async () => {
    await renderMarkdown('## Delay compensation')
    const heading = screen.getByRole('heading', {
      level: 2,
      name: 'Delay compensation',
    })
    expect(heading).toBeInTheDocument()
    expect(heading.className).toMatch(/text-brand/)
  })
})
