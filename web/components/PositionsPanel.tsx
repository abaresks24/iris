"use client";

import { useQuery } from "@tanstack/react-query";
import { useWallets } from "@privy-io/react-auth";
import { api } from "@/lib/api";
import { num, usd } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";

export function PositionsPanel() {
  const { wallets } = useWallets();
  const trader = wallets[0]?.address;

  const { data, isLoading } = useQuery({
    queryKey: ["account"],
    queryFn: () => api.account(),
    refetchInterval: 8000,
  });

  const { data: arc } = useQuery({
    queryKey: ["arcPositions", trader],
    queryFn: () => api.arcPositions(trader!),
    enabled: !!trader,
    refetchInterval: 8000,
  });

  const arcPositions = arc?.positions ?? [];
  const arcBlock =
    arcPositions.length > 0 ? (
      <div style={{ marginBottom: 20 }}>
        <div className="flex between" style={{ marginBottom: 8 }}>
          <b>On-chain positions · Arc</b>
          <span className="muted small">settled on-chain · matched on Derive</span>
        </div>
        <div className="grid">
          {arcPositions.map((p) => (
            <div key={p.id} className="panel flex between">
              <div>
                <b>{p.instrument}</b>
                <div className="muted small">
                  {p.kind} · size {num(p.size)} · strike {usd(p.strike)}
                </div>
              </div>
              <div className="right">
                <div className="ok">{usd(p.premium)}</div>
                <a
                  href={`${arc!.explorer}/address/${arc!.contract}`}
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
      </div>
    ) : null;

  if (isLoading) return <div className="notice"><IrisLoader /> Loading…</div>;

  if (!data || data.tradingEnabled === false) {
    return (
      <div>
        {arcBlock}
        <div className="notice warn">
          Derive backend is in read-only mode. Positions above are settled
          on-chain on Arc from your matched Derive fills.
        </div>
      </div>
    );
  }

  const positions = data.subaccount?.positions ?? [];
  const collateral = data.subaccount?.collaterals ?? [];
  const openOrders = data.openOrders?.orders ?? [];

  return (
    <div>
      {arcBlock}
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        {collateral.map((col: any) => (
          <div key={col.asset_name} className="kpi panel">
            <div className="v">{num(Number(col.amount))} {col.asset_name}</div>
            <div className="l">collateral</div>
          </div>
        ))}
        <div className="kpi panel">
          <div className="v">{positions.length}</div>
          <div className="l">open positions</div>
        </div>
        <div className="kpi panel">
          <div className="v">{openOrders.length}</div>
          <div className="l">resting orders</div>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="notice">No open positions yet — place a strategy above.</div>
      ) : (
        <div className="grid">
          {positions.map((p: any) => (
            <div key={p.instrument_name} className="panel flex between">
              <div>
                <b>{p.instrument_name}</b>
                <div className="muted small">
                  size {num(Number(p.amount))} · avg {num(Number(p.average_price))}
                </div>
              </div>
              <div className="right">
                <div className={Number(p.unrealized_pnl) >= 0 ? "ok" : "err"}>
                  {num(Number(p.unrealized_pnl))} USDC
                </div>
                <div className="muted small">unrealized</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
