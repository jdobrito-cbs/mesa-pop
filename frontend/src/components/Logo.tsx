/**
 * Wordmark "mesa pop" — o "o" de pop é a ficha de jogo da marca.
 * Renderizado com a webfont Baloo 2 (ver STYLE_GUIDE.md).
 */
export function Chip({
  size = 28,
  spin = false,
}: {
  size?: number | string
  spin?: boolean
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      className={spin ? 'animate-chip-spin' : undefined}
    >
      <circle cx="50" cy="50" r="46" fill="#FFF9F0" />
      <circle
        cx="50"
        cy="50"
        r="37"
        fill="none"
        stroke="#1B1235"
        strokeWidth="10"
        strokeDasharray="12 18"
        strokeLinecap="round"
        transform="rotate(18 50 50)"
      />
      <circle cx="50" cy="50" r="20" fill="none" stroke="#1B1235" strokeWidth="6" />
      <circle cx="50" cy="50" r="8.5" fill="#F252C1" />
    </svg>
  )
}

export function Spark({ size = 14, className = 'text-pop-yellow' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={className}>
      <path d="M12 1l2.4 6.6L21 10l-6.6 2.4L12 19l-2.4-6.6L3 10l6.6-2.4Z" fill="currentColor" />
    </svg>
  )
}

export default function Logo({ className = 'text-3xl' }: { className?: string }) {
  return (
    <span
      className={`font-display inline-flex items-baseline font-bold tracking-tight select-none ${className}`}
    >
      <span className="text-text">mesa</span>
      <span className="ml-[0.18em] inline-flex items-baseline font-extrabold text-pop-cyan">
        p
        <span className="mx-[0.04em] inline-flex translate-y-[0.1em] items-center">
          <Chip size="0.74em" spin />
        </span>
        p
      </span>
      <span className="relative -top-[0.55em] left-[0.08em]">
        <Spark />
      </span>
    </span>
  )
}
