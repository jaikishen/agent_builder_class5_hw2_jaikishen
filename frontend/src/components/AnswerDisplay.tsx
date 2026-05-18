import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

export interface AnswerDisplayProps {
  markdown: string
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-semibold tracking-tight text-brand">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 text-xl font-semibold tracking-tight text-brand">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 text-lg font-semibold text-brand">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="my-2 leading-relaxed text-text">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc pl-6 marker:text-muted">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal pl-6 marker:text-muted">{children}</ol>
  ),
  li: ({ children }) => <li className="my-1">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-brand underline underline-offset-2 hover:opacity-80"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...rest }) => {
    // Fenced blocks come through with className="language-..."; inline
    // backticks have no className. Style the chip; leave the block to <pre>.
    if (className) {
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded bg-surface px-1 py-0.5 font-mono text-sm text-text"
        {...rest}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-md border border-white/10 bg-surface p-3 font-mono text-sm">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-surface text-left">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-white/10 px-3 py-1 font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-white/10 px-3 py-1">{children}</td>
  ),
}

export function AnswerDisplay({ markdown }: AnswerDisplayProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {markdown}
    </ReactMarkdown>
  )
}
