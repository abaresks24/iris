import { PositionsPanel } from "@/components/PositionsPanel";

export default function PortfolioPage() {
  return (
    <div style={{ paddingTop: 24 }}>
      <div className="section-title">Your positions on Derive</div>
      <PositionsPanel />
    </div>
  );
}
