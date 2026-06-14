"use client";

import { Deposit } from "@/components/Deposit";
import { PositionsPanel } from "@/components/PositionsPanel";
import { HistoryPanel } from "@/components/HistoryPanel";

export default function DashboardPage() {
  return (
    <div style={{ paddingTop: 28 }}>
      <h1 className="title-serif" style={{ fontSize: 40, margin: "0 0 6px" }}>Dashboard</h1>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        Your positions and activity, settled on-chain on Arc.
      </p>

      <div className="section-title">Fund your account</div>
      <div className="panel flex between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <b>Deposit to trade</b>
          <div className="muted small" style={{ marginTop: 2 }}>
            One click funds your wallet on Arc — gas, test USDC and vault approval.
          </div>
        </div>
        <Deposit />
      </div>

      <div className="section-title">Positions</div>
      <PositionsPanel />

      <div className="section-title">Recent activity</div>
      <HistoryPanel />
    </div>
  );
}
