"use client";

import { useCountUp } from "@/lib/useCountUp";

/** A number that counts up from 0 on mount/value-change, formatted by `format`. */
export function CountUp({
  value,
  format,
  fallback = "—",
}: {
  value: number | null;
  format: (n: number) => string;
  fallback?: string;
}) {
  const v = useCountUp(value);
  if (value == null) return <>{fallback}</>;
  return <>{format(v)}</>;
}
