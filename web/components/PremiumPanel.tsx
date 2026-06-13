"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usd } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";

/**
 * "Premium" — the upfront yield you've collected. The hook of the whole
 * product: you get paid the moment you deposit.
 */
export function PremiumPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["account"],
    queryFn: () => api.account(),
    refetchInterval: 10000,
  });

  if (isLoading)
    return (
      <div className="notice">
        <IrisLoader /> Loading…
      </div>
    );

  const positions: any[] = data?.subaccount?.positions ?? [];
  // Premium collected = sum of (open value received) — approximated from
  // realized + the premium leg of each short position when available.
  const earned = positions.reduce(
    (s, p) => s + Math.abs(Number(p.realized_pnl ?? 0)),
    0,
  );
  const active = positions.length;

  return (
    <div>
      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="kpi">
            <div className="v" style={{ color: "var(--color-accent)", fontSize: 32 }}>{usd(earned)}</div>
            <div className="l">premium earned upfront</div>
          </div>
        </div>
        <div className="panel">
          <div className="kpi">
            <div className="v" style={{ fontSize: 32 }}>{active}</div>
            <div className="l">active earning positions</div>
          </div>
        </div>
        <div className="panel">
          <div className="kpi">
            <div className="v" style={{ fontSize: 32 }}>—</div>
            <div className="l">next settlement</div>
          </div>
        </div>
      </div>

      <div className="callout ex">
        <span className="tag">How &quot;upfront&quot; works</span>
        Every strategy pays its premium the moment your deposit fills — that cash
        is yours immediately. You keep it in full if the option expires
        worthless; otherwise it offsets your effective entry price.
      </div>

      {!data || data.tradingEnabled === false ? (
        <div className="placeholder">
          <h3>No premium yet</h3>
          <p>Connect a configured account and start an Earn position — your upfront premium lands here.</p>
        </div>
      ) : active === 0 ? (
        <div className="placeholder">
          <h3>No active positions</h3>
          <p>Head to <a href="/app/earn">Earn</a> to collect your first upfront premium.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Instrument</th><th>Size</th><th className="right">Realized</th></tr>
          </thead>
          <tbody>
            {positions.map((p, i) => (
              <tr key={p.instrument_name ?? i}>
                <td className="mono">{p.instrument_name}</td>
                <td>{p.amount}</td>
                <td className="right">{usd(Number(p.realized_pnl ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
