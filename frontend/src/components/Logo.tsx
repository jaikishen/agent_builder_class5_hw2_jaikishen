interface LogoProps {
  size?: number
  className?: string
}

/** SkyNova brand mark — Supabase-green squircle with a rising chart line. */
export function Logo({ size = 32, className = '' }: LogoProps) {
  const r = size * 0.28
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="SkyNova mark"
      className={className}
    >
      <rect width="32" height="32" rx={r} fill="var(--color-brand)" />
      {/* Takeoff trajectory — two segments climbing right. */}
      <path
        d="M7 21 L13 14 L17.5 18 L25 10"
        stroke="var(--color-bg)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="25" cy="10" r="1.5" fill="var(--color-bg)" />
    </svg>
  )
}
