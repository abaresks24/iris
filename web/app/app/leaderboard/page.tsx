import { LeaderboardPanel } from "@/components/LeaderboardPanel";

export default function LeaderboardPage() {
  return (
    <div style={{ paddingTop: 28 }}>
      <h1 className="title-serif" style={{ fontSize: 40, margin: "0 0 6px" }}>Leaderboard</h1>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        Top earners by premium collected across Iris.
      </p>
      <LeaderboardPanel />
    </div>
  );
}
