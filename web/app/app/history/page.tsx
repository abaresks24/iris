import { HistoryPanel } from "@/components/HistoryPanel";

export default function HistoryPage() {
  return (
    <div style={{ paddingTop: 24 }}>
      <div className="section-title">Trade history</div>
      <HistoryPanel />
    </div>
  );
}
