"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { api, type PresetId } from "@/lib/api";
import { pct, usd } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";
import { CountUp } from "./CountUp";
import { DepositModal } from "./DepositModal";

interface Opp {
  currency: string;
  preset: PresetId;
  label: string;
  capPct: number;
}

// Asset × strategy matrix (income presets only — these are what you "earn" on).
const ASSETS = ["ETH", "BTC", "SOL"];
const ASSET_COLOR: Record<string, string> = {
  ETH: "var(--color-accent)", // violet
  BTC: "var(--color-gold)", // amber
  SOL: "var(--color-accent-2)", // green
};
const STRATS: { preset: PresetId; label: string }[] = [
  { preset: "cash_secured_put", label: "Cash-Secured Put" },
  { preset: "covered_call", label: "Covered Call" },
  { preset: "long_call", label: "Buy Call" },
];
const CAP: Record<string, number> = {
  "ETH-cash_secured_put": 38, "BTC-cash_secured_put": 61, "SOL-cash_secured_put": 19,
  "ETH-covered_call": 24, "BTC-covered_call": 47, "SOL-covered_call": 12,
  "ETH-long_call": 55, "BTC-long_call": 40, "SOL-long_call": 30,
};

const OPPS: Opp[] = ASSETS.flatMap((currency) =>
  STRATS.map((s) => ({
    currency,
    preset: s.preset,
    label: s.label,
    capPct: CAP[`${currency}-${s.preset}`] ?? 30,
  })),
);

type Filter = "all" | "cash_secured_put" | "covered_call" | "long_call";
type SortKey = "asset" | "type" | "maxApr";

export function EarnExplorer() {
  const router = useRouter();
  const [active, setActive] = useState<Opp | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("maxApr");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const results = useQueries({
    queries: OPPS.map((o) => ({
      queryKey: ["strategies", o.preset, o.currency, 1],
      queryFn: () => api.strategies(o.preset, o.currency, 1),
      // Poll the live orderbook so APRs visibly move (the market-maker sim).
      staleTime: 3_000,
      refetchInterval: 6_000,
      refetchIntervalInBackground: false,
    })),
  });

  const rows = useMemo(() => {
    return OPPS.map((o, i) => {
      const r = results[i];
      const aprs = (r.data?.candidates ?? []).map((c) => c.aprPct ?? 0).filter((a) => a > 0);
      const prems = (r.data?.candidates ?? []).map((c) => c.premium ?? 0).filter((p) => p > 0);
      return {
        ...o,
        loading: r.isLoading,
        maxApr: aprs.length ? Math.max(...aprs) : null,
        minApr: aprs.length ? Math.min(...aprs) : null,
        prem: prems.length ? Math.min(...prems) : null,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join(",")]);

  const view = useMemo(() => {
    let r = rows.filter((x) => (filter === "all" ? true : x.preset === filter));
    const dir = sortDir === "asc" ? 1 : -1;
    r = [...r].sort((a, b) => {
      if (sortKey === "asset") return a.currency.localeCompare(b.currency) * dir;
      if (sortKey === "type") return a.label.localeCompare(b.label) * dir;
      // maxApr — nulls always last
      const av = a.maxApr ?? -1;
      const bv = b.maxApr ?? -1;
      return (av - bv) * dir;
    });
    return r;
  }, [rows, filter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "maxApr" ? "desc" : "asc");
    }
  }
  const caret = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  const TABS: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "cash_secured_put", label: "Cash-Secured Puts" },
    { id: "covered_call", label: "Covered Calls" },
    { id: "long_call", label: "Buy Calls" },
  ];

  return (
    <div>
      <div className="preset-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`preset-tab ${filter === t.id ? "active" : ""}`}
            onClick={() => setFilter(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("asset")}>Asset{caret("asset")}</th>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("type")}>Strategy{caret("type")}</th>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("maxApr")}>{view[0]?.preset === "long_call" ? "Premium" : "APR"}{caret("maxApr")}</th>
              <th>Capacity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr
                key={`${r.currency}-${r.preset}`}
                className="reveal"
                style={{ cursor: "pointer", animationDelay: `${i * 45}ms` }}
                onClick={() => setActive(r)}
              >
                <td>
                  <span className="asset-chip">
                    <span className="tok" style={{ background: ASSET_COLOR[r.currency] ?? "var(--color-accent)" }}>
                      {r.currency.slice(0, 1)}
                    </span>
                    {r.currency}
                  </span>
                </td>
                <td>{r.label}</td>
                <td>
                  {r.loading ? (
                    <IrisLoader size={14} />
                  ) : r.preset === "long_call" ? (
                    <span className="apr-range">
                      <span className="max"><CountUp value={r.prem} format={(n) => usd(n)} /></span>
                      <span className="min">cost</span>
                    </span>
                  ) : (
                    <span className="apr-range">
                      <span className="min">{pct(r.minApr, 1)}</span>
                      <span className="sep">–</span>
                      <span className="max"><CountUp value={r.maxApr} format={(n) => pct(n, 1)} /></span>
                    </span>
                  )}
                </td>
                <td>
                  <div className="flex" style={{ gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 56, height: 6, borderRadius: 999, background: "var(--color-surface)", border: "1px solid var(--color-hairline)" }}>
                      <div style={{ width: `${r.capPct}%`, height: "100%", borderRadius: 999, background: "var(--spectrum)" }} />
                    </div>
                    <span className="small muted">{r.capPct}%</span>
                  </div>
                </td>
                <td className="right">
                  <button
                    className="btn sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActive(r);
                    }}
                  >
                    {r.preset === "long_call" ? `Buy ${r.currency}` : `Earn on ${r.currency}`}
                  </button>
                </td>
              </tr>
            ))}
            {view.length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 24 }}>No opportunities.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {active && (
        <DepositModal
          currency={active.currency}
          preset={active.preset}
          label={active.label}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            router.push("/app/dashboard");
          }}
        />
      )}
    </div>
  );
}
