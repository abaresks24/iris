"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { num } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";

export function HistoryPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: () => api.history(),
    refetchInterval: 12000,
  });

  if (isLoading)
    return (
      <div className="notice">
        <IrisLoader /> Loading trade history…
      </div>
    );

  if (!data || data.tradingEnabled === false) {
    return (
      <div className="placeholder">
        <h3>No trade history yet</h3>
        <p>
          Connect a configured Derive account (see Docs → Onboarding) and your
          fills will appear here.
        </p>
      </div>
    );
  }

  const trades: any[] = data.trades ?? [];
  if (trades.length === 0) {
    return (
      <div className="placeholder">
        <h3>No trades yet</h3>
        <p>Place a strategy from the Trade tab — your fills land here.</p>
      </div>
    );
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Instrument</th>
          <th>Side</th>
          <th>Amount</th>
          <th>Price</th>
          <th className="right">Realized P&amp;L</th>
        </tr>
      </thead>
      <tbody>
        {trades.map((t, i) => (
          <tr key={t.trade_id ?? i}>
            <td>{t.timestamp ? new Date(Number(t.timestamp)).toLocaleString() : "—"}</td>
            <td className="mono">{t.instrument_name}</td>
            <td className={t.direction === "buy" ? "ok" : "err"}>{t.direction}</td>
            <td>{num(Number(t.trade_amount ?? t.amount ?? 0))}</td>
            <td>{num(Number(t.trade_price ?? t.price ?? 0))}</td>
            <td className="right">
              {t.realized_pnl != null ? num(Number(t.realized_pnl)) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
