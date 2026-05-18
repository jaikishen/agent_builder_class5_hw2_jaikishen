import { AnswerDisplay } from './components/AnswerDisplay'
import { ChatInput } from './components/ChatInput'
import { ErrorBanner } from './components/ErrorBanner'
import { HealthFooter } from './components/HealthFooter'
import { Hero } from './components/Hero'
import { LoadingSpinner } from './components/LoadingSpinner'
import { Sidebar } from './components/Sidebar'
import { ToolCallTrace } from './components/ToolCallTrace'
import { useChat } from './hooks/useChat'

function App() {
  const { state, response, error, send, retry, reset } = useChat()

  const showEmptyState = state === 'idle' && response === null && error === null

  return (
    <>
      {/* The h1 lives once for accessibility / tests; visual brand mark is in the sidebar. */}
      <h1 className="sr-only">SkyNova Airlines Agent</h1>

      <div className="relative z-10 flex min-h-screen">
        <Sidebar
          onPickExample={send}
          onNewConversation={reset}
          showExamples={showEmptyState}
        />

        <main className="relative flex min-h-screen flex-1 flex-col">
          {/* Top bar — just status, no breadcrumb noise */}
          <div className="flex items-center justify-end border-b border-[var(--color-line)] px-10 py-4 fade-up">
            <HealthFooter />
          </div>

          {/* Conversation area */}
          <div className="flex flex-1 flex-col px-10 py-8">
            <div
              aria-live="polite"
              className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-7"
            >
              {showEmptyState && <Hero />}
              {state === 'loading' && <LoadingSpinner />}
              {state === 'error' && error && (
                <ErrorBanner message={error.message} onRetry={retry} />
              )}
              {response && (
                <div className="space-y-6 fade-up">
                  <ToolCallTrace
                    toolCalls={response.tool_calls}
                    warnings={response.warnings}
                    elapsedMs={response.elapsed_ms}
                  />
                  <article className="rounded-md border border-[var(--color-line)] bg-[var(--color-bg-soft)] p-6">
                    <div className="eyebrow mb-3">Answer</div>
                    <AnswerDisplay markdown={response.answer} />
                  </article>
                </div>
              )}
            </div>
          </div>

          {/* Composer + foot caption */}
          <div className="border-t border-[var(--color-line)] px-10 py-6">
            <div className="mx-auto w-full max-w-3xl space-y-3">
              <ChatInput onSubmit={send} disabled={state === 'loading'} />
              <p className="text-center font-mono text-[10.5px] uppercase tracking-wider text-[var(--color-muted)]">
                Read-only · single turn · trace included with every answer
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

export default App
