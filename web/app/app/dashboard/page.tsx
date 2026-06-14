"use client";

import { ArcBalanceCard } from "@/components/ArcBalanceCard";
import { PositionsPanel } from "@/components/PositionsPanel";
import { HistoryPanel } from "@/components/HistoryPanel";

export default function DashboardPage() {
  return (
    <div style={{ paddingTop: 28 }}>
      <h1 className="title-serif" style={{ fontSize: 40, margin: "0 0 6px" }}>Dashboard</h1>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        Your balance, positions and activity, settled on-chain on Arc.
      </p>

      <div className="section-title">Balance</div>
      <ArcBalanceCard />

      <div className="section-title">Positions</div>
      <PositionsPanel />

      <div className="section-title">Recent activity</div>
      <HistoryPanel />
    </div>
  );
}
