"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useIris } from "@/lib/protocol/useIris";
import { usd, pct } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";
import { DepositModal } from "./DepositModal";

interface Opp {
  kind: "put" | "call";
  label: string;
  tagline: string;
  apr: number | null;
}

export function EarnExplorer() {
  const iris = useIris();
  const router = useRouter();
  const [spot, setSpot] = useState<number | null>(null);
  const [opps, setOpps] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<"put" | "call" | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const s = await iris.getSpotUsd();
        const expiry = Math.floor(Date.now() / 1000) + 30 * 86400;
        const round = (n: number) => Math.max(1, Math.round(n / 50) * 50);
        const [putQ, callQ] = await Promise.all([
          iris.quotePut(round(s * 0.9), 1, expiry),
          iris.quoteCall(1, expiry),
        ]);
        if (cancel) return;
        setSpot(s);
        setOpps([
          { kind: "put", label: "Cash-Secured Put", tagline: "Deposit USDC, earn yield. Worst case: buy ETH cheaper.", apr: putQ.aprPct },
          { kind: "call", label: "Covered Call", tagline: "Hold ETH, earn extra yield on top.", apr: callQ.aprPct },
        ]);
      } catch {
        if (!cancel) setOpps([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="notice">
        <IrisLoader /> Loading live ETH options from Arc…
      </div>
    );
  }

  return (
    <div>
      {spot != null && (
        <p className="muted small" style={{ margin: "0 0 16px" }}>
          ETH spot <span className="numeric">{usd(spot)}</span> · 30-day term · live on Arc
        </p>
      )}
      <div className="grid cols-2">
        {opps.map((o) => (
          <div key={o.kind} className="card" onClick={() => setActive(o.kind)}>
            <div className="flex between">
              <div className="strike">Earn on ETH</div>
              <span className="badge">{o.label}</span>
            </div>
            <div className="apr numeric">
              {pct(o.apr)} <small>APR</small>
            </div>
            <div className="summary">{o.tagline}</div>
            <div className="muted small">
              {o.kind === "put" ? "collateral: USDC" : "collateral: ETH (WETH)"}
            </div>
          </div>
        ))}
      </div>

      {active && spot != null && (
        <DepositModal
          kind={active}
          spotUsd={spot}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            router.push("/app/dashboard");
          }}
        />
      )}
    </div>
  );
}
