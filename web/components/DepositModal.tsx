"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallets } from "@privy-io/react-auth";
import { useAccount, useSwitchChain, useWriteContract, usePublicClient } from "wagmi";
import { api, type ArcSettlement, type Economics, type PresetId } from "@/lib/api";
import {
  arcTestnet, VAULT_ADDRESS, USDC_ADDRESS, VAULT_ABI, USDC_ABI, MARKET_ID,
  UNDERLYING_BY_CURRENCY, toFeed8, toSize18, ARC_EXPLORER,
} from "@/lib/arc/vault";
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
  const [step, setStep] = useState("");
  const { wallets } = useWallets();
  const trader = wallets[0]?.address;
  const { address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const arcClient = usePublicClient({ chainId: arcTestnet.id });

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
    if (!(amount > 0)) { setStatus("error"); setMessage("Enter an amount greater than 0"); return; }
    setStatus("sending");
    setMessage("");
    setArc(null);
    try {
      if (preset === "cash_secured_put" || preset === "covered_call") await runVault(selected);
      else await runMirror(selected);
    } catch (e: any) {
      setStatus("error");
      setStep("");
      setMessage(e?.shortMessage || (e instanceof Error ? e.message : "Order failed"));
    }
  }

  // Income/buy presets the vault doesn't custody yet → Derive matching + Arc record.
  async function runMirror(sel: Economics) {
    const res = await api.trade({ preset, instrumentName: sel.instrumentName, amount, trader });
    setStatus("done");
    const id = (res.order as any)?.order?.order_id ?? (res.order as any)?.order_id ?? "submitted";
    setMessage(String(id));
    if (res.arcSettlement && "txHash" in res.arcSettlement) setArc(res.arcSettlement);
  }

  // CSP / Covered Call → REAL on-chain on the Arc vault: lock collateral
  // (USDC for a put, the underlying for a call), receive premium, from the
  // user's wallet. Derive supplied the price.
  async function runVault(sel: Economics) {
    const acct = (address ?? trader) as `0x${string}` | undefined;
    if (!acct) throw new Error("Connect your wallet first");
    if (!arcClient) throw new Error("Arc network unavailable");
    const isCSP = preset === "cash_secured_put";
    const marketId = MARKET_ID[currency] ?? 0;
    const strike = toFeed8(sel.strike);
    const size = toSize18(amount);
    const expiry = BigInt(Math.floor(sel.expiry));
    const collToken = isCSP ? USDC_ADDRESS : (UNDERLYING_BY_CURRENCY[currency] ?? USDC_ADDRESS);
    const collLabel = isCSP ? "USDC" : `test ${currency}`;

    setStep("Switching to Arc…");
    await switchChainAsync({ chainId: arcTestnet.id });

    setStep("Topping up gas…");
    await fetch("/api/gas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: acct }),
    }).catch(() => {});

    const [collateralWei] = (isCSP
      ? await arcClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "quoteCashSecuredPut", args: [marketId, strike, size, expiry] })
      : await arcClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "quoteCoveredCall", args: [marketId, size, expiry] })
    ) as [bigint, bigint];

    const bal = (await arcClient.readContract({
      address: collToken, abi: USDC_ABI, functionName: "balanceOf", args: [acct],
    })) as bigint;
    if (bal < collateralWei) {
      setStep(`Minting ${collLabel}…`);
      const h = await writeContractAsync({
        address: collToken, abi: USDC_ABI, functionName: "mint",
        args: [acct, collateralWei], chainId: arcTestnet.id,
      });
      await arcClient.waitForTransactionReceipt({ hash: h });
    }

    const allowance = (await arcClient.readContract({
      address: collToken, abi: USDC_ABI, functionName: "allowance", args: [acct, VAULT_ADDRESS],
    })) as bigint;
    if (allowance < collateralWei) {
      setStep(`Approving ${collLabel}…`);
      const h = await writeContractAsync({
        address: collToken, abi: USDC_ABI, functionName: "approve",
        args: [VAULT_ADDRESS, collateralWei], chainId: arcTestnet.id,
      });
      await arcClient.waitForTransactionReceipt({ hash: h });
    }

    setStep("Opening position…");
    const hash = await writeContractAsync({
      address: VAULT_ADDRESS, abi: VAULT_ABI,
      functionName: isCSP ? "openCashSecuredPut" : "openCoveredCall",
      args: [marketId, strike, size, expiry], chainId: arcTestnet.id,
    });
    await arcClient.waitForTransactionReceipt({ hash });

    setStep("");
    setStatus("done");
    setMessage(`+${usd(upfront)} premium`);
    setArc({ txHash: hash, explorerUrl: `${ARC_EXPLORER}/tx/${hash}`, contract: VAULT_ADDRESS, chainId: arcTestnet.id });
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
              <div className="hero-num shimmer" style={{ fontSize: 46, lineHeight: 1 }}>
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
                min={0.001}
                step="any"
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
              />
              <span className="muted small">Min 0.001 · fractional sizes supported</span>
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

            {status === "sending" ? (
              <p className="muted small flex" style={{ gap: 8 }}><IrisLoader size={14} /> {step || "Submitting…"}</p>
            ) : status === "done" ? (
              <>
                <IrisBloom />
                <p className="ok small" style={{ textAlign: "center" }}>
                  {preset !== "long_call"
                    ? <>✓ Position opened on Arc · <span className="mono">{message}</span></>
                    : <>✓ {isBuy ? "Bought" : "Earning"} on Derive · <span className="mono">{message}</span></>}
                </p>
                {arc ? (
                  <p className="ok small" style={{ marginTop: 6, textAlign: "center" }}>
                    ⛓ {preset !== "long_call" ? "Collateral locked + premium paid on Arc" : "Settled on-chain on Arc"} ·{" "}
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
