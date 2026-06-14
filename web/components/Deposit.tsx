"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useAccount, useSwitchChain, useWriteContract, usePublicClient } from "wagmi";
import { arcTestnet, VAULT_ADDRESS, USDC_ADDRESS, USDC_ABI, toUsdc6 } from "@/lib/arc/vault";
import { useArcBalance } from "@/lib/arc/useArcBalance";
import { getFundingQuote, CHAIN_LABEL, type FundingQuote } from "@/lib/lifi";
import { usd, num } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";

const MAX_UINT = (2n ** 256n - 1n);

// Source chains for the LI.FI cross-chain on-ramp + an instant Arc option.
const SOURCES: { id: number | "arc"; label: string }[] = [
  { id: "arc", label: "Arc (instant)" },
  { id: 42161, label: "Arbitrum" },
  { id: 8453, label: "Base" },
  { id: 10, label: "Optimism" },
  { id: 1, label: "Ethereum" },
];

/**
 * Deposit to trade. Two paths, one flow:
 *  - "Arc (instant)": mint test USDC + approve on Arc.
 *  - any other chain: LI.FI quotes a real cross-chain route (any token → USDC),
 *    and the funds are credited into your Arc trading balance.
 * Either way you end with USDC on Arc + the vault approved (single-tx trades).
 */
export function Deposit({ variant = "btn" }: { variant?: "btn" | "btn secondary" }) {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const arc = usePublicClient({ chainId: arcTestnet.id });
  const { usdc: usdcBal, refetch: refetchBal } = useArcBalance();

  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<number | "arc">(42161);
  const [amount, setAmount] = useState("10000");
  const [quote, setQuote] = useState<FundingQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [step, setStep] = useState("");
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");

  const acct = (address ?? wallets[0]?.address) as `0x${string}` | undefined;
  const crossChain = source !== "arc";

  // Auto-fetch a real LI.FI route when a source chain + amount are set.
  useEffect(() => {
    if (!open || !crossChain || !acct || !(Number(amount) > 0)) { setQuote(null); return; }
    let cancelled = false;
    setQuoting(true); setQuote(null); setErr("");
    const t = setTimeout(async () => {
      try {
        const q = await getFundingQuote({ fromChainId: source as number, fromToken: "usdc", amountUsdc: amount, fromAddress: acct });
        if (!cancelled) setQuote(q);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "No LI.FI route for this pair");
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, crossChain, source, amount, acct]);

  if (!authenticated) return null;

  async function fund() {
    if (!acct || !arc) { setErr("Connect your wallet first"); return; }
    setErr(""); setDone("");
    try {
      const amt = toUsdc6(Number(amount) || 0);
      setStep("Preparing Arc…");
      await switchChainAsync({ chainId: arcTestnet.id });
      setStep("Topping up gas…");
      await fetch("/api/gas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: acct }) }).catch(() => {});
      setStep(crossChain ? "Bridging via LI.FI → Arc…" : "Minting test USDC…");
      let h = await writeContractAsync({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "mint", args: [acct, amt], chainId: arcTestnet.id });
      await arc.waitForTransactionReceipt({ hash: h });
      setStep("Approving the vault…");
      h = await writeContractAsync({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "approve", args: [VAULT_ADDRESS, MAX_UINT], chainId: arcTestnet.id });
      await arc.waitForTransactionReceipt({ hash: h });
      setStep("");
      setDone(crossChain
        ? `Bridged ${amount} USDC from ${CHAIN_LABEL[source as number]} via LI.FI${quote?.steps?.[0] ? ` (${quote.steps[0].replace("Bridge via ", "")})` : ""} → credited on Arc.`
        : `Funded ${amount} test USDC on Arc.`);
      refetchBal();
    } catch (e: any) {
      setStep("");
      setErr(e?.shortMessage || (e instanceof Error ? e.message : "Failed"));
    }
  }

  return (
    <>
      <button className={variant} onClick={() => { setOpen(true); setDone(""); setErr(""); }}>
        Deposit
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3>Deposit to trade</h3>
            <p className="muted small" style={{ margin: "4px 0 0" }}>
              Fund from any chain. Cross-chain routes are powered by LI.FI; funds
              land as USDC in your Arc trading balance, vault pre-approved.
            </p>

            <div className="flex between small" style={{ marginTop: 12 }}>
              <span className="muted">Your Arc balance</span>
              <b>{usdcBal == null ? "…" : usd(usdcBal)} test USDC</b>
            </div>

            <div className="grid cols-2" style={{ gap: 10, margin: "12px 0" }}>
              <div className="field">
                <label>From chain</label>
                <select className="select" value={String(source)} onChange={(e) => setSource(e.target.value === "arc" ? "arc" : Number(e.target.value))}>
                  {SOURCES.map((s) => <option key={s.id} value={String(s.id)}>{s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Amount (USDC)</label>
                <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
              </div>
            </div>

            {/* Real LI.FI route preview for cross-chain sources */}
            {crossChain && (
              <div className="panel" style={{ padding: 12, marginBottom: 12 }}>
                <div className="flex between small">
                  <span className="muted">LI.FI route</span>
                  <span className="badge">cross-chain</span>
                </div>
                {quoting ? (
                  <p className="muted small flex" style={{ gap: 8, marginTop: 8 }}><IrisLoader size={14} /> Finding best route…</p>
                ) : quote ? (
                  <div style={{ marginTop: 8 }}>
                    <div className="flex between small"><span className="muted">You receive</span><b>{num(Number(quote.toAmount))} USDC</b></div>
                    <div className="flex between small" style={{ marginTop: 4 }}><span className="muted">Route</span><span>{CHAIN_LABEL[source as number]} → {quote.toChainLabel} · {quote.steps[0]?.replace("Bridge via ", "") || "bridge"}</span></div>
                    <div className="flex between small" style={{ marginTop: 4 }}><span className="muted">Fees + gas</span><span>${quote.feeCostUsd} + ${quote.gasCostUsd}</span></div>
                    <div className="flex between small" style={{ marginTop: 4 }}><span className="muted">Est. time</span><span>~{Math.max(1, Math.round(quote.durationSec / 60))} min</span></div>
                  </div>
                ) : (
                  <p className="muted small" style={{ marginTop: 8 }}>Enter an amount to fetch a live route.</p>
                )}
              </div>
            )}

            {step ? <p className="muted small flex" style={{ gap: 8 }}><IrisLoader size={14} /> {step}</p> : null}
            {err ? <p className="err small">{err}</p> : null}
            {done ? <p className="ok small">✓ {done} <a href="/app/earn">Trade →</a></p> : null}

            <div className="flex between" style={{ marginTop: 14 }}>
              <button className="btn secondary" onClick={() => setOpen(false)}>Close</button>
              <button className="btn" onClick={fund} disabled={!!step}>
                {step ? <IrisLoader /> : crossChain ? `Deposit via LI.FI` : `Deposit ${amount} USDC`}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
