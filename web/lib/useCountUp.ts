"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animate a number from 0 → target with an ease-out cubic. Returns the current
 * value; re-runs whenever `target` changes. Cheap (one rAF loop, ~900ms).
 */
export function useCountUp(target: number | null, ms = 900): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0); // last displayed value — tween from here, not 0
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (target == null) {
      setValue(0);
      fromRef.current = 0;
      return;
    }
    if (typeof performance === "undefined" || typeof requestAnimationFrame === "undefined") {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      setValue(v);
      fromRef.current = v;
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, ms]);

  return value;
}
