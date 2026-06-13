"use client";

import { useFunding } from "@/app/providers";
import { FundingPanel } from "@/components/FundingPanel";
import { PositionsPanel } from "@/components/PositionsPanel";
import { HistoryPanel } from "@/components/HistoryPanel";

export default function DashboardPage() {
  const { privyEnabled } = useFunding();

  return (
    <div style={{ paddingTop: 28 }}>
      <h1 style={{ fontSize: 36, margin: "0 0 6px" }}>Dashboard</h1>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        Your balance, positions and activity on Derive.
      </p>

      <div className="section-title">Fund your account</div>
      {privyEnabled ? (
        <FundingPanel />
      ) : (
        <div className="notice warn">
          Add <span className="mono">NEXT_PUBLIC_PRIVY_APP_ID</span> to enable
          cross-chain funding (Privy + LI.FI).
        </div>
      )}

      <div className="section-title">Positions</div>
      <PositionsPanel />

      <div className="section-title">Recent activity</div>
      <HistoryPanel />
    </div>
  );
}
