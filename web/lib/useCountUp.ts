"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animate a number from 0 → target with an ease-out cubic. Returns the current
 * value; re-runs whenever `target` changes. Cheap (one rAF loop, ~900ms).
 */
export function useCountUp(target: number | null, ms = 900): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (target == null) {
      setValue(0);
      return;
    }
    if (typeof performance === "undefined" || typeof requestAnimationFrame === "undefined") {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, ms]);

  return value;
}
