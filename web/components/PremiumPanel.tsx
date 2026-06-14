"use client";

import { useEffect, useState } from "react";
import { useIris } from "@/lib/protocol/useIris";
import type { Position } from "@/lib/protocol/vault";
import { usd } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";

export function PremiumPanel() {
  const iris = useIris();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!iris.address) {
      setLoading(false);
      return;
    }
    iris.getPositions().then(setPositions).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iris.address]);

  if (!iris.address) return <div className="notice warn">Connect a wallet on Arc to see your premium.</div>;
  if (loading) return <div className="notice"><IrisLoader /> Loading…</div>;

  const earned = positions.reduce((s, p) => s + p.premium, 0);
  const active = positions.filter((p) => !p.settled).length;

  return (
    <div>
      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="kpi">
            <div className="v numeric" style={{ color: "var(--color-accent)", fontSize: 32 }}>{usd(earned)}</div>
            <div className="l">premium earned upfront</div>
          </div>
        </div>
        <div className="panel">
          <div className="kpi">
            <div className="v numeric" style={{ fontSize: 32 }}>{active}</div>
            <div className="l">active earning positions</div>
          </div>
        </div>
        <div className="panel">
          <div className="kpi">
            <div className="v numeric" style={{ fontSize: 32 }}>{positions.length}</div>
            <div className="l">total positions</div>
          </div>
        </div>
      </div>
      <div className="callout ex">
        <span className="tag">How &quot;upfront&quot; works</span>
        Every position pays its premium the moment it opens — that USDC is yours
        immediately, paid from the protocol treasury. You keep it in full if the
        option expires worthless.
      </div>
    </div>
  );
}
