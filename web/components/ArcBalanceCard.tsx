"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useArcBalance } from "@/lib/arc/useArcBalance";
import { usd, num } from "@/lib/format";
import { Deposit } from "./Deposit";

/** Dashboard balance card — your funds on Arc, with a one-click Deposit. */
export function ArcBalanceCard() {
  const { authenticated } = usePrivy();
  const { usdc, gas } = useArcBalance();

  if (!authenticated) {
    return (
      <div className="panel flex between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <b>Deposit to trade</b>
          <div className="muted small" style={{ marginTop: 2 }}>
            Connect your wallet, then deposit test USDC on Arc in one click.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
      <div className="flex" style={{ gap: 28 }}>
        <div className="kpi">
          <div className="v" style={{ color: "var(--color-accent)" }}>{usdc == null ? "…" : usd(usdc)}</div>
          <div className="l">test USDC on Arc</div>
        </div>
        <div className="kpi">
          <div className="v">{gas == null ? "…" : `${num(gas)} `}<span className="muted" style={{ fontSize: 13 }}>gas</span></div>
          <div className="l">native (Arc)</div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <Deposit />
        <div className="muted small" style={{ marginTop: 6 }}>1-click: gas + test USDC + approve</div>
      </div>
    </div>
  );
}
