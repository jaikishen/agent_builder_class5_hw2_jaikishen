export function Hero() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center fade-up">
      <div className="eyebrow mb-5 flex items-center gap-2">
        <span className="inline-block h-[5px] w-[5px] rounded-full bg-[var(--color-brand)]" />
        <span>SkyNova Assistant</span>
      </div>

      <h2 className="font-display text-[44px] font-normal leading-[1.05] tracking-tight text-[var(--color-text)]">
        Ask anything.{' '}
        <span className="italic text-[var(--color-brand)]">
          We'll show our work.
        </span>
      </h2>

      <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--color-text-soft)]">
        SkyNova reaches across customers, flights, bookings, tickets, reviews,
        and the policy handbook — every answer comes with the reasoning trail.
      </p>
    </div>
  )
}
