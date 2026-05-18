import { AnswerDisplay } from './components/AnswerDisplay'
import { ChatInput } from './components/ChatInput'
import { ToolCallTrace } from './components/ToolCallTrace'
import { useChat } from './hooks/useChat'

function App() {
  const { state, response, error, send } = useChat()

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-brand">
          SkyNova Airlines Agent
        </h1>
        <p className="mt-2 text-sm text-muted">
          Phase F3 wiring &middot; backend at{" "}
          <code className="rounded bg-surface px-1 py-0.5 font-mono text-brand">
            localhost:8000
          </code>
        </p>
      </header>

      <ChatInput onSubmit={send} disabled={state === 'loading'} />

      {state === 'loading' && (
        <p className="text-center text-muted">Thinking…</p>
      )}

      {state === 'error' && error && (
        <pre className="overflow-x-auto rounded-md border border-red-500/40 bg-red-500/10 p-3 font-mono text-sm text-red-300">
          {error.message}
        </pre>
      )}

      {response && (
        <>
          <article className="rounded-md border border-white/10 bg-surface/40 p-4">
            <AnswerDisplay markdown={response.answer} />
          </article>
          <ToolCallTrace
            toolCalls={response.tool_calls}
            warnings={response.warnings}
            elapsedMs={response.elapsed_ms}
          />
        </>
      )}
    </main>
  )
}

export default App
