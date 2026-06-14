"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useIris } from "@/lib/protocol/useIris";
import type { Quote } from "@/lib/protocol/vault";
import { usd, num, pct } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";
import { FundDrawer } from "./FundDrawer";

type Kind = "put" | "call";
const EXPIRIES = [7, 14, 30, 60];

export function OrderTicket() {
  const iris = useIris();
  const router = useRouter();

  const [spot, setSpot] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>("put");
  const [strike, setStrike] = useState<number | null>(null);
  const [size, setSize] = useState(1);
  const [days, setDays] = useState(30);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [bal, setBal] = useState<{ usdc: number; weth: number } | null>(null);

  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [fundOpen, setFundOpen] = useState(false);

  const expirySec = useMemo(() => Math.floor(Date.now() / 1000) + days * 86400, [days]);

  // strike presets relative to spot
  const round = (n: number) => Math.max(1, Math.round(n / 50) * 50);
  const strikes = useMemo(() => {
    if (spot == null) return [];
    return kind === "put"
      ? [0.95, 0.9, 0.85].map((m) => round(spot * m))
      : [1.05, 1.1, 1.15].map((m) => round(spot * m));
  }, [spot, kind]);

  // load spot once
  useEffect(() => {
    iris.getSpotUsd().then(setSpot).catch(() => setSpot(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // default strike when spot/kind changes
  useEffect(() => {
    if (strikes.length) setStrike(strikes[1]);
  }, [strikes]);

  // balances when connected
  useEffect(() => {
    if (iris.address) iris.getBalances().then(setBal).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iris.address, status]);

  // live quote on any change
  useEffect(() => {
    if (strike == null) return;
    let cancel = false;
    setQuoting(true);
    const p = kind === "put" ? iris.quotePut(strike, size, expirySec) : iris.quoteCall(size, expirySec);
    p.then((q) => !cancel && setQuote(q))
      .catch(() => !cancel && setQuote(null))
      .finally(() => !cancel && setQuoting(false));
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, strike, size, expirySec]);

  const breakeven = useMemo(() => {
    if (!quote || strike == null) return null;
    const perUnit = quote.premium / size;
    return kind === "put" ? strike - perUnit : strike + perUnit;
  }, [quote, strike, size, kind]);

  const needsDeposit =
    kind === "put" && quote != null && bal != null && quote.collateral > bal.usdc;

  async function earn() {
    if (!iris.ready) {
      setStatus("error");
      setMessage("Connect a wallet on Arc first.");
      return;
    }
    if (strike == null) return;
    setStatus("sending");
    setMessage("");
    try {
      const hash =
        kind === "put"
          ? await iris.openPut(strike, size, expirySec)
          : await iris.openCall(strike, size, expirySec);
      setStatus("done");
      setMessage(hash);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Transaction failed");
    }
  }

  return (
    <>
      <div className="ticket">
        {/* ── Left: the order form ── */}
        <div className="panel">
          <div className="seg">
            <button className={`seg-btn ${kind === "put" ? "on" : ""}`} onClick={() => setKind("put")}>
              Cash-Secured Put
            </button>
            <button className={`seg-btn ${kind === "call" ? "on" : ""}`} onClick={() => setKind("call")}>
              Covered Call
            </button>
          </div>
          <p className="sub" style={{ marginTop: 12 }}>
            {kind === "put"
              ? "Deposit USDC, earn the premium now. Worst case: buy ETH at the strike."
              : "Lock ETH, earn extra yield. Capped if ETH rises above the strike."}
          </p>

          <div className="field" style={{ marginTop: 8 }}>
            <label>Strike</label>
            <div className="seg">
              {strikes.map((s) => (
                <button key={s} className={`seg-btn ${strike === s ? "on" : ""}`} onClick={() => setStrike(s)}>
                  {usd(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid cols-2" style={{ marginTop: 14 }}>
            <div className="field">
              <label>Size (ETH)</label>
              <input
                className="input numeric"
                type="number"
                min={0.01}
                step={0.01}
                value={size}
                onChange={(e) => setSize(Math.max(0.01, Number(e.target.value) || 0.01))}
              />
            </div>
            <div className="field">
              <label>Expiry</label>
              <div className="seg">
                {EXPIRIES.map((d) => (
                  <button key={d} className={`seg-btn ${days === d ? "on" : ""}`} onClick={() => setDays(d)}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex" style={{ marginTop: 18, gap: 10 }}>
            <button className="btn ghost" onClick={() => setFundOpen(true)}>
              Deposit
            </button>
            <button
              className="btn block"
              onClick={earn}
              disabled={status === "sending" || !quote || needsDeposit}
            >
              {status === "sending" ? (
                <IrisLoader />
              ) : needsDeposit ? (
                "Deposit USDC to earn"
              ) : quote ? (
                `Earn ${usd(quote.premium)} upfront`
              ) : (
                "…"
              )}
            </button>
          </div>

          {status === "done" && (
            <p className="ok small" style={{ marginTop: 12 }}>
              ✓ Position open on Arc ·{" "}
              <a onClick={() => router.push("/app/dashboard")} style={{ cursor: "pointer" }}>view dashboard →</a>
            </p>
          )}
          {status === "error" && <p className="err small" style={{ marginTop: 12 }}>{message}</p>}
          {bal && (
            <p className="muted small" style={{ marginTop: 12 }}>
              Balance: <span className="numeric">{num(bal.usdc)}</span> USDC ·{" "}
              <span className="numeric">{num(bal.weth)}</span> WETH
            </p>
          )}
        </div>

        {/* ── Right: live preview ── */}
        <div className="panel preview">
          <div className="muted small" style={{ marginBottom: 4 }}>You earn upfront</div>
          <div className="numeric" style={{ fontSize: 46, lineHeight: 1, color: "var(--color-accent)" }}>
            {quoting || !quote ? <IrisLoader size={30} /> : usd(quote.premium)}
          </div>
          <div className="apr-tag numeric">{quote ? pct(quote.aprPct) : "—"} APR</div>

          <div className="divider" />
          <Row k="Strategy" v={kind === "put" ? "Cash-Secured Put" : "Covered Call"} />
          <Row k="You lock" v={quote ? `${num(quote.collateral)} ${quote.collateralAsset}` : "—"} mono />
          <Row k="Breakeven" v={breakeven != null ? usd(breakeven) : "—"} mono />
          <Row k="Expiry" v={`${days} days`} />
          <Row k="ETH spot" v={spot != null ? usd(spot) : "—"} mono />

          <div className="callout" style={{ marginTop: 16, marginBottom: 0 }}>
            {kind === "put"
              ? "Keep the full premium if ETH stays above the strike at expiry. Below it, you buy ETH at an effective price near breakeven — fully collateralised, no liquidation."
              : "Keep the premium + your ETH if it stays below the strike. Above it, your ETH is sold at the strike. Fully collateralised."}
          </div>
        </div>
      </div>

      {fundOpen && <FundDrawer onClose={() => setFundOpen(false)} />}
    </>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex between" style={{ padding: "6px 0", fontSize: 14 }}>
      <span className="muted">{k}</span>
      <span className={mono ? "numeric" : ""}>{v}</span>
    </div>
  );
}
