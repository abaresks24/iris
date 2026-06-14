"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { api } from "@/lib/api";
import { usd, days } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";
import { TokenIcon } from "./TokenIcon";

/**
 * "Premium" — the upfront yield the connected wallet has collected. The hook of
 * the product: you get paid the moment your deposit fills.
 */
export function PremiumPanel() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const trader = wallets[0]?.address;

  const { data, isLoading } = useQuery({
    queryKey: ["arcPositions", trader],
    queryFn: () => api.arcPositions(trader!),
    enabled: !!trader,
    refetchInterval: 10000,
  });

  const positions = data?.positions ?? [];
  const earned = positions.reduce((s, p) => s + (p.premium || 0), 0);
  const nowSec = Date.now() / 1000;
  const upcoming = positions.filter((p) => p.expiry > nowSec).map((p) => (p.expiry - nowSec) / 86400);
  const nextDays = upcoming.length ? Math.min(...upcoming) : null;

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
            <div className="v" style={{ fontSize: 32 }}>{positions.length}</div>
            <div className="l">active earning positions</div>
          </div>
        </div>
        <div className="panel">
          <div className="kpi">
            <div className="v" style={{ fontSize: 32 }}>{nextDays != null ? days(nextDays) : "—"}</div>
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

      {!ready ? (
        <div className="notice"><IrisLoader /> …</div>
      ) : !authenticated || !trader ? (
        <div className="placeholder">
          <h3>Connect your wallet</h3>
          <p>Start an Earn position and your upfront premium lands here.</p>
        </div>
      ) : isLoading ? (
        <div className="notice"><IrisLoader /> Loading…</div>
      ) : positions.length === 0 ? (
        <div className="placeholder">
          <h3>No premium yet</h3>
          <p>Head to <a href="/app/earn">Earn</a> to collect your first upfront premium.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr><th>Asset</th><th>Strategy</th><th>Strike</th><th className="right">Premium</th></tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="asset-chip">
                      <TokenIcon currency={p.instrument.split("-")[0]} size={20} />
                      {p.instrument.split("-")[0]}
                    </span>
                  </td>
                  <td>{p.kind}</td>
                  <td>{usd(p.strike)}</td>
                  <td className="right ok">{usd(p.premium)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
