import { Logo } from './Logo'

export function Hero() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center fade-up">
      <Logo size={52} className="mb-6" />

      <h2 className="font-display text-[42px] font-normal leading-[1.05] tracking-tight text-[var(--color-text)]">
        Ask anything.{' '}
        <span className="italic text-[var(--color-brand)]">We'll show our work.</span>
      </h2>

      <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--color-text-soft)]">
        SkyNova reaches across customers, flights, bookings, tickets, reviews,
        and the policy handbook. Every answer comes with the reasoning trail.
      </p>

      <div className="mt-8 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider text-[var(--color-muted)]">
        <span className="inline-block h-[5px] w-[5px] rounded-full bg-[var(--color-brand)]" />
        <span>Type below, or pick from the sidebar</span>
      </div>
    </div>
  )
}
