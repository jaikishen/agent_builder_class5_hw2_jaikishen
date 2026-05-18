import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

export interface AnswerDisplayProps {
  markdown: string
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="font-display text-[26px] font-normal leading-tight tracking-tight text-brand">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 font-display text-[21px] font-normal leading-tight tracking-tight text-brand">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 font-display text-[17px] font-medium tracking-tight text-brand">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="my-2 text-[14.5px] leading-relaxed text-[var(--color-text)]">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-none space-y-2 pl-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-6 marker:font-mono marker:text-[var(--color-muted)]">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="flex gap-3 text-[14.5px] leading-relaxed text-[var(--color-text)]">
      <span className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--color-brand)]" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--color-text)]">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="font-display italic text-[var(--color-text)]">{children}</em>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-brand underline underline-offset-2 decoration-[var(--color-brand)]/40 hover:decoration-[var(--color-brand)]"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...rest }) => {
    if (className) {
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded border border-[var(--color-line)] bg-surface px-1.5 py-0.5 font-mono text-[12.5px] text-[var(--color-text)]"
        {...rest}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-md border border-[var(--color-line)] bg-surface p-3 font-mono text-[12.5px] leading-relaxed text-[var(--color-text)]">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-[var(--color-brand)] pl-4 font-display text-[15px] italic text-[var(--color-text-soft)]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-[var(--color-line)]" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-md border border-[var(--color-line)]">
      <table className="w-full border-collapse text-[13.5px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[var(--color-surface)] text-left">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-[var(--color-line)] px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-[var(--color-line)] px-3 py-2 text-[var(--color-text)] last:border-b-0">
      {children}
    </td>
  ),
}

export function AnswerDisplay({ markdown }: AnswerDisplayProps) {
  return (
    <div className="font-sans">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
