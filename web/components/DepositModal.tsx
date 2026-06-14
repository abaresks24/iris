"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallets } from "@privy-io/react-auth";
import { api, type ArcSettlement, type Economics, type PresetId } from "@/lib/api";
import { usd, num, pct, days } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";
import { IrisBloom } from "./IrisBloom";

/**
 * Rysk-style "earn upfront" deposit flow. Asset + strategy come in; the strike
 * and expiry are abstracted (best APR picked by default), revealed only under
 * an "Advanced" expander.
 */
export function DepositModal({
  currency,
  preset,
  label,
  onClose,
  onDone,
}: {
  currency: string;
  preset: PresetId;
  label: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(1);
  const [chosen, setChosen] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [arc, setArc] = useState<ArcSettlement | null>(null);
  const { wallets } = useWallets();
  const trader = wallets[0]?.address;

  const { data, isLoading } = useQuery({
    queryKey: ["strategies", preset, currency, 1],
    queryFn: () => api.strategies(preset, currency, 1),
  });

  // default selection = highest-APR (liquid first) candidate
  const selected: Economics | undefined = useMemo(() => {
    if (!data?.candidates?.length) return undefined;
    if (chosen) return data.candidates.find((c) => c.instrumentName === chosen) ?? data.candidates[0];
    return data.candidates[0];
  }, [data, chosen]);

  const isBuy = preset === "long_call";
  const upfront = selected ? selected.premium * amount : 0; // earned (sell) or paid (buy)
  const collateral = selected ? selected.collateralRequired * amount : 0;

  async function confirm() {
    if (!selected) return;
    setStatus("sending");
    setMessage("");
    try {
      const res = await api.trade({ preset, instrumentName: selected.instrumentName, amount, trader });
      setStatus("done");
      const id =
        (res.order as any)?.order?.order_id ?? (res.order as any)?.order_id ?? "submitted";
      setMessage(String(id));
      if (res.arcSettlement && "txHash" in res.arcSettlement) setArc(res.arcSettlement);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Order failed");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex between">
          <h3>{isBuy ? `Buy ${currency} Call` : `Earn on ${currency}`}</h3>
          <span className="badge">{label}</span>
        </div>

        {isLoading ? (
          <div className="notice" style={{ marginTop: 16 }}>
            <IrisLoader /> Loading the best terms from Derive…
          </div>
        ) : !selected ? (
          <div className="notice warn" style={{ marginTop: 16 }}>
            No live opportunity for {currency} right now.
          </div>
        ) : (
          <>
            {/* The hook: premium earned upfront */}
            <div style={{ textAlign: "center", margin: "20px 0 8px" }}>
              <div className="numeric shimmer" style={{ fontSize: 40, lineHeight: 1 }}>
                {usd(upfront)}
              </div>
              <div className="muted small">
                {isBuy ? "premium to pay · max loss" : `earned upfront · ${pct(selected.aprPct)} APR`}
              </div>
            </div>

            <div className="field" style={{ margin: "16px 0" }}>
              <label>Amount ({currency})</label>
              <input
                className="input"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>

            <div className="flex between small">
              <span className="muted">{isBuy ? "You pay" : "You lock"}</span>
              <b>{isBuy ? usd(upfront) : `${num(collateral)} ${selected.collateralAsset === "USDC" ? "USDC" : currency}`}</b>
            </div>
            <div className="flex between small" style={{ marginTop: 6 }}>
              <span className="muted">{isBuy ? "Breakeven (profit above)" : "Effective entry / breakeven"}</span>
              <span>{usd(selected.breakeven)}</span>
            </div>
            <div className="flex between small" style={{ marginTop: 6 }}>
              <span className="muted">Term</span>
              <span>{days(selected.daysToExpiry)} · strike {usd(selected.strike)}</span>
            </div>

            {/* Advanced: pick a different strike/term */}
            <button
              className="btn secondary block"
              style={{ marginTop: 14 }}
              onClick={() => setAdvanced((v) => !v)}
            >
              {advanced ? "Hide advanced" : "Advanced — choose strike"}
            </button>
            {advanced && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {data!.candidates.map((c) => (
                  <div
                    key={c.instrumentName}
                    className="flex between small"
                    style={{
                      padding: "8px 10px",
                      border: "1.5px solid var(--color-hairline-strong)",
                      borderRadius: 8,
                      cursor: "pointer",
                      background:
                        c.instrumentName === selected.instrumentName ? "var(--color-surface)" : "transparent",
                    }}
                    onClick={() => setChosen(c.instrumentName)}
                  >
                    <span>strike {usd(c.strike)} · {days(c.daysToExpiry)}</span>
                    <b style={{ color: "var(--color-accent)" }}>{pct(c.aprPct)}</b>
                  </div>
                ))}
              </div>
            )}

            {!selected.liquid && (
              <p className="muted small" style={{ marginTop: 10 }}>
                Thin testnet book — priced off mark. Crosses the live book on mainnet.
              </p>
            )}

            <div className="divider" />

            {status === "done" ? (
              <>
                <IrisBloom />
                <p className="ok small" style={{ textAlign: "center" }}>✓ {isBuy ? "Bought" : "Earning"} on Derive · matched & filled <span className="mono">{message}</span></p>
                {arc ? (
                  <p className="ok small" style={{ marginTop: 6 }}>
                    ⛓ Settled on-chain on Arc ·{" "}
                    <a href={arc.explorerUrl} target="_blank" rel="noreferrer" className="mono" style={{ color: "var(--color-accent-2)" }}>
                      {arc.txHash.slice(0, 10)}…{arc.txHash.slice(-6)} ↗
                    </a>
                  </p>
                ) : (
                  <p className="muted small" style={{ marginTop: 6 }}>Settling on Arc…</p>
                )}
              </>
            ) : status === "error" ? (
              <p className="err small">{message}</p>
            ) : null}

            <div className="flex between" style={{ marginTop: 12 }}>
              <button className="btn secondary" onClick={onClose}>
                {status === "done" ? "Close" : "Cancel"}
              </button>
              {status === "done" ? (
                <button className="btn" onClick={onDone}>View dashboard</button>
              ) : (
                <button className="btn" onClick={confirm} disabled={status === "sending"}>
                  {status === "sending" ? <IrisLoader /> : isBuy ? `Buy for ${usd(upfront)}` : `Earn ${usd(upfront)} upfront`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
