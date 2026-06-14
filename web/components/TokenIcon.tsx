/**
 * Inline SVG token logos (no external image deps → never broken, crisp at any
 * size). ETH / BTC / SOL; falls back to a colored monogram for anything else.
 */
export function TokenIcon({ currency, size = 22 }: { currency: string; size?: number }) {
  const c = currency.toUpperCase();
  const common = { width: size, height: size, viewBox: "0 0 32 32", style: { flex: "none" as const, display: "block" } };

  if (c === "ETH")
    return (
      <svg {...common} aria-label="ETH">
        <circle cx="16" cy="16" r="16" fill="#627EEA" />
        <g fill="#fff" fillRule="nonzero">
          <path fillOpacity="0.6" d="M16.5 4v8.87l7.5 3.35z" />
          <path d="M16.5 4 9 16.22l7.5-3.35z" />
          <path fillOpacity="0.6" d="M16.5 21.97V28L24 17.62z" />
          <path d="M16.5 28v-6.03L9 17.62z" />
          <path fillOpacity="0.2" d="m16.5 20.57 7.5-4.35-7.5-3.35z" />
          <path fillOpacity="0.6" d="m9 16.22 7.5 4.35v-7.7z" />
        </g>
      </svg>
    );

  if (c === "BTC")
    return (
      <svg {...common} aria-label="BTC">
        <circle cx="16" cy="16" r="16" fill="#F7931A" />
        <path
          fill="#fff"
          d="M22.5 14.4c.3-1.9-1.2-2.9-3.2-3.6l.6-2.6-1.6-.4-.6 2.5c-.4-.1-.9-.2-1.3-.3l.6-2.5-1.6-.4-.6 2.6c-.3-.1-.7-.2-1-.2v0l-2.2-.6-.4 1.7s1.2.3 1.2.3c.7.2.8.6.8 1l-.8 3c0 .1.1.1.1.1l-.1 0-1 4.1c-.1.2-.3.4-.7.3 0 0-1.2-.3-1.2-.3l-.8 1.9 2.1.5c.4.1.8.2 1.1.3l-.6 2.6 1.6.4.6-2.6c.4.1.9.2 1.3.3l-.6 2.6 1.6.4.6-2.6c2.7.5 4.8.3 5.6-2.2.7-2 0-3.1-1.4-3.9 1.1-.2 1.9-1 2.1-2.4zM18.8 18.9c-.5 2-3.8.9-4.9.6l.8-3.3c1.1.3 4.6.8 4.1 2.7zm.5-4.6c-.4 1.8-3.2.9-4.1.7l.7-3c.9.2 3.9.6 3.4 2.3z"
        />
      </svg>
    );

  if (c === "SOL")
    return (
      <svg {...common} aria-label="SOL">
        <defs>
          <linearGradient id="iris-sol" x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#9945FF" />
            <stop offset="1" stopColor="#14F195" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="16" fill="#131316" />
        <g fill="url(#iris-sol)">
          <path d="M10 20.4c.15-.15.35-.24.56-.24h13.1c.36 0 .54.43.28.69l-2.5 2.5a.8.8 0 0 1-.56.24H7.78c-.36 0-.54-.43-.28-.69z" />
          <path d="M10 8.4a.8.8 0 0 1 .56-.24h13.1c.36 0 .54.43.28.69l-2.5 2.5a.8.8 0 0 1-.56.24H7.78c-.36 0-.54-.43-.28-.69z" />
          <path d="M21.44 14.36a.8.8 0 0 0-.56-.24H7.78c-.36 0-.54.43-.28.69l2.5 2.5c.15.15.35.24.56.24h13.1c.36 0 .54-.43.28-.69z" />
        </g>
      </svg>
    );

  // fallback monogram
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center",
        fontSize: size * 0.42, fontWeight: 700, color: "#08140E", background: "var(--color-accent)", flex: "none",
      }}
    >
      {c.slice(0, 1)}
    </span>
  );
}
