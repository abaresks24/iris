"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Economics, type PresetId } from "@/lib/api";
import { usd, num, pct, days } from "@/lib/format";
import { TradeModal } from "./TradeModal";
import { IrisLoader } from "./IrisLoader";

const PRESETS: { id: PresetId; label: string; hint: string }[] = [
  { id: "cash_secured_put", label: "Earn (Cash-Secured Put)", hint: "Deposit USDC, earn yield" },
  { id: "covered_call", label: "Covered Call", hint: "Yield on held asset" },
  { id: "long_call", label: "Buy Call", hint: "Bet on upside" },
];

const CURRENCIES = ["ETH", "BTC"];

export function StrategyExplorer() {
  const [preset, setPreset] = useState<PresetId>("cash_secured_put");
  const [currency, setCurrency] = useState("ETH");
  const [amount, setAmount] = useState(1);
  const [selected, setSelected] = useState<Economics | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["strategies", preset, currency, amount],
    queryFn: () => api.strategies(preset, currency, amount),
  });

  const isIncome = preset !== "long_call";

  return (
    <div>
      <div className="flex between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="preset-tabs">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className={`preset-tab ${preset === p.id ? "active" : ""}`}
              onClick={() => setPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex">
          <select
            className="select"
            style={{ width: 90 }}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: 110 }}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          >
            {[1, 2, 5, 10].map((a) => (
              <option key={a} value={a}>
                {a} {currency}
              </option>
            ))}
          </select>
        </div>
      </div>

      {data && data.indexPrice > 0 && (
        <p className="muted small" style={{ margin: "4px 0 16px" }}>
          {currency} index {usd(data.indexPrice)} · expiry in {days(data.daysToExpiry)} ·
          live from Derive orderbook
        </p>
      )}

      {isLoading && (
        <div className="notice">
          <IrisLoader /> Loading live options from Derive…
        </div>
      )}
      {error && <div className="notice warn">{(error as Error).message}</div>}

      {data && (
        <div className="grid cols-3">
          {data.candidates.map((c) => (
            <div key={c.instrumentName} className="card" onClick={() => setSelected(c)}>
              {isIncome ? (
                <div className="apr">
                  {pct(c.aprPct)} <small>APR</small>
                </div>
              ) : (
                <div className="apr">
                  {usd(c.premium)} <small>premium</small>
                </div>
              )}
              <div className="strike">
                {c.currency} ${num(c.strike)} {c.preset === "long_call" ? "Call" : c.preset === "covered_call" ? "Call" : "Put"}
              </div>
              <div className="row">
                <span className="k">{isIncome ? "Premium" : "Breakeven"}</span>
                <span>{isIncome ? usd(c.premiumTotal) : usd(c.breakeven)}</span>
              </div>
              <div className="row">
                <span className="k">{isIncome ? "Collateral" : "Max loss"}</span>
                <span>
                  {isIncome
                    ? `${num(c.collateralRequired)} ${c.collateralAsset === "USDC" ? "USDC" : c.currency}`
                    : usd(c.premiumTotal)}
                </span>
              </div>
              <div className="flex">
                <span className={`badge ${c.liquid ? "green" : "warn"}`}>
                  {c.liquid ? "live quote" : "mark price"}
                </span>
                {c.iv != null && <span className="badge">IV {(c.iv * 100).toFixed(0)}%</span>}
              </div>
              <div className="summary">{c.summary}</div>
            </div>
          ))}
          {data.candidates.length === 0 && (
            <div className="notice">No live instruments for this selection.</div>
          )}
        </div>
      )}

      {selected && (
        <TradeModal
          economics={selected}
          onClose={() => setSelected(null)}
          onTraded={() => {
            setSelected(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
