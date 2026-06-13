"use client";

/**
 * Leaderboard — skeleton only. Derive exposes no public ranking endpoint, so
 * this is a structural placeholder. Wire it later to an Iris-side index of
 * volume / realized PnL / premium earned per connected user.
 */
const ROWS = [
  { rank: 1, trader: "—", volume: "—", earned: "—" },
  { rank: 2, trader: "—", volume: "—", earned: "—" },
  { rank: 3, trader: "—", volume: "—", earned: "—" },
];

export function LeaderboardPanel() {
  return (
    <div>
      <div className="notice" style={{ marginBottom: 16 }}>
        Skeleton — ranks Iris users by premium earned & volume. Needs an Iris-side
        index (no public Derive leaderboard endpoint). Structure is ready for data.
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Trader</th>
            <th>Volume (USDC)</th>
            <th className="right">Premium earned</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.rank}>
              <td>{r.rank}</td>
              <td className="mono">{r.trader}</td>
              <td>{r.volume}</td>
              <td className="right">{r.earned}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
