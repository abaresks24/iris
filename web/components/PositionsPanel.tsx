"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { num } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";

export function PositionsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["account"],
    queryFn: () => api.account(),
    refetchInterval: 8000,
  });

  if (isLoading) return <div className="notice"><IrisLoader /> Loading…</div>;

  if (!data || data.tradingEnabled === false) {
    return (
      <div className="notice warn">
        Backend is in read-only mode. Set your Derive account + session key in
        <span className="mono"> server/.env</span> to place real orders and see
        positions here. (See README → onboarding.)
      </div>
    );
  }

  const positions = data.subaccount?.positions ?? [];
  const collateral = data.subaccount?.collaterals ?? [];
  const openOrders = data.openOrders?.orders ?? [];

  return (
    <div>
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
