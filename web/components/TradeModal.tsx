"use client";

import { useState } from "react";
import { api, type Economics } from "@/lib/api";
import { usd, num, pct } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";

export function TradeModal({
  economics: c,
  onClose,
  onTraded,
}: {
  economics: Economics;
  onClose: () => void;
  onTraded: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const isIncome = c.preset !== "long_call";

  async function confirm() {
    setStatus("sending");
    setMessage("");
    try {
      const res = await api.trade({
        preset: c.preset,
        instrumentName: c.instrumentName,
        amount: c.amount,
      });
      setStatus("done");
      const orderId =
        (res.order as any)?.order?.order_id ??
        (res.order as any)?.order_id ??
        "submitted";
      setMessage(String(orderId));
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Order failed");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>
          {isIncome ? "Earn with" : "Buy"} {c.currency} ${num(c.strike)}{" "}
          {c.preset === "cash_secured_put" ? "Put" : "Call"}
        </h3>
        <p className="muted small" style={{ marginTop: 4 }}>
          {c.instrumentName}
        </p>

        <div className="divider" />

        <div className="grid cols-2" style={{ gap: 14 }}>
          {isIncome ? (
            <>
              <Kpi label="APR" value={pct(c.aprPct)} accent />
              <Kpi label="Premium now" value={usd(c.premiumTotal)} />
              <Kpi
                label="Collateral"
                value={`${num(c.collateralRequired)} ${c.collateralAsset === "USDC" ? "USDC" : c.currency}`}
              />
              <Kpi label="Effective entry" value={usd(c.breakeven)} />
            </>
          ) : (
            <>
              <Kpi label="Cost" value={usd(c.premiumTotal)} />
              <Kpi label="Breakeven" value={usd(c.breakeven)} accent />
              <Kpi label="Max loss" value={usd(c.premiumTotal)} />
              <Kpi label="Strike" value={usd(c.strike)} />
            </>
          )}
        </div>

        <div className="notice" style={{ marginTop: 16 }}>
          {c.summary}
        </div>

        {!c.liquid && (
          <p className="muted small" style={{ marginTop: 10 }}>
            Note: thin testnet book — priced off mark. On mainnet this crosses the
            live orderbook.
          </p>
        )}

        <div className="divider" />

        {status === "done" ? (
          <p className="ok">✓ Order placed on Derive · <span className="mono">{message}</span></p>
        ) : status === "error" ? (
          <p className="err small">{message}</p>
        ) : null}

        <div className="flex between" style={{ marginTop: 12 }}>
          <button className="btn secondary" onClick={onClose}>
            {status === "done" ? "Close" : "Cancel"}
          </button>
          {status === "done" ? (
            <button className="btn" onClick={onTraded}>
              View position
            </button>
          ) : (
            <button className="btn" onClick={confirm} disabled={status === "sending"}>
              {status === "sending" ? (
                <IrisLoader />
              ) : isIncome ? (
                `Earn ${pct(c.aprPct)} APR`
              ) : (
                "Buy call"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="kpi">
      <div className="v" style={accent ? { color: "var(--accent)" } : undefined}>
        {value}
      </div>
      <div className="l">{label}</div>
    </div>
  );
}
