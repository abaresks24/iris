"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { api } from "@/lib/api";
import { usd } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";
import { TokenIcon } from "./TokenIcon";

/** The connected wallet's own activity — positions opened on Arc. */
export function HistoryPanel() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const trader = wallets[0]?.address;

  const { data, isLoading } = useQuery({
    queryKey: ["positions", trader],
    queryFn: () => api.positions(trader!),
    enabled: !!trader,
    refetchInterval: 10000,
  });

  if (!ready) return <div className="notice"><IrisLoader /> …</div>;
  if (!authenticated || !trader)
    return (
      <div className="placeholder">
        <h3>Connect your wallet</h3>
        <p>Your activity will appear here once you connect and trade.</p>
      </div>
    );
  if (isLoading) return <div className="notice"><IrisLoader /> Loading your activity…</div>;

  const fills = data?.positions ?? [];
  if (fills.length === 0)
    return (
      <div className="placeholder">
        <h3>No activity yet</h3>
        <p>Open a strategy from <a href="/app/earn">Earn</a> — your fills land here.</p>
      </div>
    );

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Asset</th>
            <th>Strategy</th>
            <th>Premium</th>
            <th className="right">On-chain</th>
          </tr>
        </thead>
        <tbody>
          {fills.map((f, i) => (
            <tr key={`${f.source}-${i}`}>
              <td>{f.time ? new Date(f.time * 1000).toLocaleString() : "—"}</td>
              <td>
                <span className="asset-chip">
                  <TokenIcon currency={f.asset} size={20} />
                  {f.label}
                </span>
              </td>
              <td>{f.kind}</td>
              <td className="ok">{usd(f.premium)}</td>
              <td className="right">
                <a
                  href={`${data!.explorer}/address/${data!.vault}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mono small"
                  style={{ color: "var(--color-accent-2)" }}
                >
                  {f.real ? "↗" : "recorded ↗"}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
