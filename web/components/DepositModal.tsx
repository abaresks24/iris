"use client";

import { useEffect, useMemo, useState } from "react";
import { useIris } from "@/lib/protocol/useIris";
import type { Quote } from "@/lib/protocol/vault";
import { usd, num, pct } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";

/**
 * On-chain "earn upfront" flow against the OptionVault on Arc.
 * kind=put → cash-secured put (USDC collateral); kind=call → covered call (WETH).
 */
export function DepositModal({
  kind,
  spotUsd,
  onClose,
  onDone,
}: {
  kind: "put" | "call";
  spotUsd: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const iris = useIris();
  const isPut = kind === "put";

  // Default strike: OTM put 10% below / OTM call 10% above spot, rounded.
  const round = (n: number) => Math.max(1, Math.round(n / 50) * 50);
  const strikes = useMemo(
    () =>
      isPut
        ? [0.95, 0.9, 0.85].map((m) => round(spotUsd * m))
        : [1.05, 1.1, 1.15].map((m) => round(spotUsd * m)),
    [spotUsd, isPut],
  );

  const [strike, setStrike] = useState(strikes[1]);
  const [amount, setAmount] = useState(1);
  const [days] = useState(30);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const expirySec = useMemo(() => Math.floor(Date.now() / 1000) + days * 86400, [days]);

  useEffect(() => {
    let cancel = false;
    setLoadingQuote(true);
    const p = isPut
      ? iris.quotePut(strike, amount, expirySec)
      : iris.quoteCall(amount, expirySec);
    p.then((q) => !cancel && setQuote(q))
      .catch(() => !cancel && setQuote(null))
      .finally(() => !cancel && setLoadingQuote(false));
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strike, amount, expirySec, isPut]);

  const upfront = quote ? quote.premium : 0;

  async function confirm() {
    if (!iris.ready) {
      setStatus("error");
      setMessage("Connect a wallet on Arc first.");
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      const hash = isPut
        ? await iris.openPut(strike, amount, expirySec)
        : await iris.openCall(strike, amount, expirySec);
      setStatus("done");
      setMessage(hash);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Transaction failed");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex between">
          <h3>Earn on ETH</h3>
          <span className="badge">{isPut ? "Cash-Secured Put" : "Covered Call"}</span>
        </div>

        <div style={{ textAlign: "center", margin: "20px 0 8px" }}>
          <div className="numeric" style={{ fontSize: 40, color: "var(--color-accent)", lineHeight: 1 }}>
            {loadingQuote ? <IrisLoader size={28} /> : usd(upfront)}
          </div>
          <div className="muted small">
            earned upfront · {quote ? pct(quote.aprPct) : "—"} APR
          </div>
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>Strike</label>
          <div className="flex" style={{ gap: 8 }}>
            {strikes.map((s) => (
              <button
                key={s}
                className={`preset-tab ${strike === s ? "active" : ""}`}
                onClick={() => setStrike(s)}
              >
                {usd(s)}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>Amount (ETH)</label>
          <input
            className="input"
            type="number"
            min={0.01}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(Math.max(0.01, Number(e.target.value) || 0.01))}
          />
        </div>

        {quote && (
          <>
            <div className="flex between small">
              <span className="muted">You lock</span>
              <b className="numeric">
                {num(quote.collateral)} {quote.collateralAsset}
              </b>
            </div>
            <div className="flex between small" style={{ marginTop: 6 }}>
              <span className="muted">Term</span>
              <span>{days}d · spot {usd(spotUsd)}</span>
            </div>
          </>
        )}

        {!isPut && (
          <button
            className="btn secondary block"
            style={{ marginTop: 12 }}
            onClick={() => iris.mintTestWeth(amount).catch(() => {})}
          >
            Need test WETH? Mint {amount} →
          </button>
        )}

        <div className="divider" />

        {status === "done" ? (
          <p className="ok small">✓ Earning on Arc · <span className="mono">{message.slice(0, 14)}…</span></p>
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
            <button className="btn" onClick={confirm} disabled={status === "sending" || !quote}>
              {status === "sending" ? <IrisLoader /> : `Earn ${usd(upfront)} upfront`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
