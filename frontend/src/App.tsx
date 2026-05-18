function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-brand">
          SkyNova Airlines Agent
        </h1>
        <p className="mt-4 text-base text-muted">
          Ask anything about passengers, flights, bookings, support tickets, reviews,
          or our handbook policies. The agent routes each question to the right
          tool and shows its work.
        </p>
        <p className="mt-8 font-mono text-sm text-muted">
          Phase F0 scaffold &middot; backend at{" "}
          <code className="rounded bg-surface px-1 py-0.5 text-brand">
            localhost:8000
          </code>
        </p>
      </div>
    </main>
  );
}

export default App;
