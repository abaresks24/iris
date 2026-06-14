"use client";

import { useCallback, useEffect, useState } from "react";
import { useIris } from "@/lib/protocol/useIris";
import type { Position } from "@/lib/protocol/vault";
import { usd, num } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";

export function PositionsPanel() {
  const iris = useIris();
  const [positions, setPositions] = useState<Position[]>([]);
  const [bal, setBal] = useState<{ usdc: number; weth: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!iris.address) {
      setLoading(false);
      return;
    }
    try {
      const [p, b] = await Promise.all([iris.getPositions(), iris.getBalances()]);
      setPositions(p);
      setBal(b);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iris.address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!iris.address) {
    return <div className="notice warn">Connect a wallet on Arc to see your positions.</div>;
  }
  if (loading) {
    return <div className="notice"><IrisLoader /> Loading from Arc…</div>;
  }

  const nowSec = Math.floor(Date.now() / 1000);

  async function doSettle(id: number) {
    setSettling(id);
    try {
      await iris.settle(id);
      await refresh();
    } catch {
      /* surfaced by wallet */
    } finally {
      setSettling(null);
    }
  }

  return (
    <div>
      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="kpi">
            <div className="v numeric">{bal ? num(bal.usdc) : "—"}</div>
            <div className="l">USDC balance</div>
          </div>
        </div>
        <div className="panel">
          <div className="kpi">
            <div className="v numeric">{bal ? num(bal.weth) : "—"}</div>
            <div className="l">WETH balance</div>
          </div>
        </div>
        <div className="panel">
          <div className="kpi">
            <div className="v numeric">{positions.filter((p) => !p.settled).length}</div>
            <div className="l">open positions</div>
          </div>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="placeholder">
          <h3>No positions yet</h3>
          <p>Head to <a href="/app/earn">Earn</a> to open your first one.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Size</th>
              <th>Premium</th>
              <th>Expiry</th>
              <th className="right">Status</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const expired = nowSec >= p.expiry;
              return (
                <tr key={p.id}>
                  <td className="mono">
                    ETH {usd(p.strike)} {p.kind === "cash_secured_put" ? "Put" : "Call"}
                  </td>
                  <td className="numeric">{num(p.size)}</td>
                  <td className="numeric">{usd(p.premium)}</td>
                  <td>{new Date(p.expiry * 1000).toLocaleDateString()}</td>
                  <td className="right">
                    {p.settled ? (
                      <span className="muted">settled</span>
                    ) : expired ? (
                      <button className="btn secondary" onClick={() => doSettle(p.id)} disabled={settling === p.id}>
                        {settling === p.id ? <IrisLoader size={14} /> : "Settle"}
                      </button>
                    ) : (
                      <span className="ok">active</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
