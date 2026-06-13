import { PointsPanel } from "@/components/PointsPanel";

export default function PointsPage() {
  return (
    <div style={{ paddingTop: 28 }}>
      <h1 style={{ fontSize: 36, margin: "0 0 6px" }}>Points</h1>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        Earn points for every premium collected and every cross-chain deposit.
      </p>
      <PointsPanel />
    </div>
  );
}
