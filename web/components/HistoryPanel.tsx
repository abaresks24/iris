"use client";

import { useEffect, useState } from "react";
import { useIris } from "@/lib/protocol/useIris";
import type { Position } from "@/lib/protocol/vault";
import { usd, num } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";

export function HistoryPanel() {
  const iris = useIris();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!iris.address) {
      setLoading(false);
      return;
    }
    iris.getPositions().then(setPositions).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iris.address]);

  if (!iris.address) return <div className="notice warn">Connect a wallet on Arc to see your activity.</div>;
  if (loading) return <div className="notice"><IrisLoader /> Loading…</div>;
  if (positions.length === 0)
    return (
      <div className="placeholder">
        <h3>No activity yet</h3>
        <p>Open a position from <a href="/app/earn">Earn</a>.</p>
      </div>
    );

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Opened</th>
          <th>Instrument</th>
          <th>Size</th>
          <th className="right">Premium</th>
        </tr>
      </thead>
      <tbody>
        {[...positions].reverse().map((p) => (
          <tr key={p.id}>
            <td>{new Date(p.openedAt * 1000).toLocaleString()}</td>
            <td className="mono">
              ETH {usd(p.strike)} {p.kind === "cash_secured_put" ? "Put" : "Call"}
            </td>
            <td className="numeric">{num(p.size)}</td>
            <td className="right numeric ok">+{usd(p.premium)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
