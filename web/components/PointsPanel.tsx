"use client";

/**
 * Points — gamification skeleton (mock balances). Wire to an Iris-side index
 * later. No multipliers; points accrue from real actions.
 */
const WAYS = [
  { action: "Premium collected", reward: "1 pt per $1 earned upfront" },
  { action: "Cross-chain deposit (LI.FI)", reward: "+200 pts" },
  { action: "First strategy", reward: "+100 pts" },
  { action: "Refer a friend", reward: "+500 pts" },
];

export function PointsPanel() {
  return (
    <div>
      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="kpi">
            <div className="v" style={{ fontSize: 32 }}>0</div>
            <div className="l">Iris points</div>
          </div>
        </div>
        <div className="panel">
          <div className="kpi">
            <div className="v" style={{ fontSize: 32 }}>—</div>
            <div className="l">rank</div>
          </div>
        </div>
        <div className="panel">
          <div className="kpi">
            <div className="v" style={{ fontSize: 32 }}>0</div>
            <div className="l">this week</div>
          </div>
        </div>
      </div>

      <div className="notice" style={{ marginBottom: 16 }}>
        Skeleton — points accrue from premium earned, volume and cross-chain
        deposits. Needs an Iris-side index; structure is ready for data.
      </div>

      <div className="section-title">Earn points</div>
      <table className="table">
        <thead>
          <tr><th>Action</th><th className="right">Reward</th></tr>
        </thead>
        <tbody>
          {WAYS.map((w) => (
            <tr key={w.action}>
              <td>{w.action}</td>
              <td className="right">{w.reward}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
