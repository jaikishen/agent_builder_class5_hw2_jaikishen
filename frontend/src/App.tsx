import { AnswerDisplay } from './components/AnswerDisplay'
import { ChatInput } from './components/ChatInput'
import { EmptyState } from './components/EmptyState'
import { ErrorBanner } from './components/ErrorBanner'
import { HealthFooter } from './components/HealthFooter'
import { LoadingSpinner } from './components/LoadingSpinner'
import { ToolCallTrace } from './components/ToolCallTrace'
import { useChat } from './hooks/useChat'

function App() {
  const { state, response, error, send, retry } = useChat()

  const showEmptyState = state === 'idle' && response === null && error === null

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-brand">
          SkyNova Airlines Agent
        </h1>
         <HealthFooter />

        {/* <p className="mt-2 text-sm text-muted">
          Phase F4 wiring &middot; backend at{" "}
          <code className="rounded bg-surface px-1 py-0.5 font-mono text-brand">
            localhost:8000
          </code>
        </p> */}
      </header>

      <ChatInput onSubmit={send} disabled={state === 'loading'} />

      {showEmptyState && <EmptyState onPick={send} />}

      {state === 'loading' && <LoadingSpinner />}

      {state === 'error' && error && (
        <ErrorBanner message={error.message} onRetry={retry} />
      )}

      <div aria-live="polite">
        {response && (
          <div className="space-y-4">
            
            <ToolCallTrace
              toolCalls={response.tool_calls}
              warnings={response.warnings}
              elapsedMs={response.elapsed_ms}
            />
            <article className="rounded-md border border-white/10 bg-surface/40 p-4">
              <AnswerDisplay markdown={response.answer} />
            </article>
          </div>
        )}
      </div>

    </main>
  )
}

export default App
