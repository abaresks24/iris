import { EarnExplorer } from "@/components/EarnExplorer";

export default function EarnPage() {
  return (
    <div style={{ paddingTop: 28 }}>
      <h1 style={{ fontSize: 42, margin: "0 0 6px" }}>Earn upfront on your crypto</h1>
      <p className="muted" style={{ margin: "0 0 4px", maxWidth: 620 }}>
        Deposit and collect the premium immediately. Every strategy is fully
        collateralised on Derive — no margin, no liquidations.
      </p>
      <div className="section-title">Opportunities</div>
      <EarnExplorer />
      <p className="small muted" style={{ marginTop: 18 }}>
        New to options? <a href="/learn">Learn how it works →</a> · Need USDC?{" "}
        <a href="/app/dashboard">Fund from any chain →</a>
      </p>
    </div>
  );
}
