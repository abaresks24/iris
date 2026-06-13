import { PremiumPanel } from "@/components/PremiumPanel";

export default function PremiumPage() {
  return (
    <div style={{ paddingTop: 28 }}>
      <h1 style={{ fontSize: 36, margin: "0 0 6px" }}>Premium</h1>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        The upfront yield you&apos;ve collected.
      </p>
      <PremiumPanel />
    </div>
  );
}
