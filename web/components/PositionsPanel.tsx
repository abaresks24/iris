"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { api } from "@/lib/api";
import { usd, days } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";
import { TokenIcon } from "./TokenIcon";

/** The connected wallet's positions, settled on-chain on Arc (per-user). */
export function PositionsPanel() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const trader = wallets[0]?.address;

  const { data, isLoading } = useQuery({
    queryKey: ["arcPositions", trader],
    queryFn: () => api.arcPositions(trader!),
    enabled: !!trader,
    refetchInterval: 8000,
  });

  if (!ready) return <div className="notice"><IrisLoader /> …</div>;
  if (!authenticated || !trader)
    return (
      <div className="placeholder">
        <h3>Connect your wallet</h3>
        <p>Connect to see the positions you&apos;ve opened, settled on-chain on Arc.</p>
      </div>
    );
  if (isLoading) return <div className="notice"><IrisLoader /> Loading your positions…</div>;

  const positions = data?.positions ?? [];
  const totalPremium = positions.reduce((s, p) => s + (p.premium || 0), 0);
  const nowSec = Date.now() / 1000;
  const upcoming = positions.filter((p) => p.expiry > nowSec).map((p) => (p.expiry - nowSec) / 86400);
  const nextDays = upcoming.length ? Math.min(...upcoming) : null;

  return (
    <div>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <div className="kpi panel">
          <div className="v">{positions.length}</div>
          <div className="l">open positions</div>
        </div>
        <div className="kpi panel">
          <div className="v" style={{ color: "var(--color-accent)" }}>{usd(totalPremium)}</div>
          <div className="l">premium collected</div>
        </div>
        <div className="kpi panel">
          <div className="v">{nextDays != null ? days(nextDays) : "—"}</div>
          <div className="l">next expiry</div>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="notice">No open positions yet — open one from <a href="/app/earn">Earn</a>.</div>
      ) : (
        <div className="grid">
          {positions.map((p) => (
            <div key={p.id} className="panel flex between">
              <div className="flex" style={{ gap: 12 }}>
                <TokenIcon currency={p.instrument.split("-")[0]} size={28} />
                <div>
                  <b>{p.instrument}</b>
                  <div className="muted small">{p.kind} · strike {usd(p.strike)} · size {p.size}</div>
                </div>
              </div>
              <div className="right">
                <div className="ok">{usd(p.premium)}</div>
                <a
                  href={`${data!.explorer}/address/${data!.contract}`}
                  target="_blank"
                  rel="noreferrer"
                  className="muted small mono"
                  style={{ color: "var(--color-accent-2)" }}
                >
                  on-chain ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
