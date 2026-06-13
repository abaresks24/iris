export const usd = (n: number, max = 2) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: max });

export const num = (n: number, max = 2) =>
  n.toLocaleString("en-US", { maximumFractionDigits: max });

export const pct = (n: number | null, digits = 1) =>
  n == null ? "—" : `${n.toFixed(digits)}%`;

export const shortAddr = (a?: string) =>
  a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";

export const days = (d: number) =>
  d >= 1 ? `${Math.round(d)}d` : `${Math.round(d * 24)}h`;
