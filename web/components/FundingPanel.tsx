"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSendTransaction, useSwitchChain } from "wagmi";
import { getFundingQuote, CHAIN_LABEL, type FundingQuote } from "@/lib/lifi";
import { num } from "@/lib/format";
import { IrisLoader } from "./IrisLoader";

const SOURCES = [42161, 10, 8453, 1];

export function FundingPanel() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const addr = wallets[0]?.address;

  const [fromChainId, setFromChainId] = useState(42161);
  const [fromToken, setFromToken] = useState<"usdc" | "native">("usdc");
  const [amount, setAmount] = useState("100");
  const [quote, setQuote] = useState<FundingQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();

  async function fetchQuote() {
    if (!addr) return;
    setLoading(true);
    setError(null);
    setQuote(null);
    setTxHash(null);
    try {
      const q = await getFundingQuote({
        fromChainId,
        fromToken,
        amountUsdc: amount,
        fromAddress: addr,
      });
      setQuote(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No route found");
    } finally {
      setLoading(false);
    }
  }

  async function execute() {
    if (!quote?.transactionRequest) return;
    setError(null);
    try {
      await switchChainAsync({ chainId: fromChainId });
      const tr = quote.transactionRequest;
      const hash = await sendTransactionAsync({
        to: tr.to,
        data: tr.data,
        value: tr.value ? BigInt(tr.value) : undefined,
        gas: tr.gasLimit ? BigInt(tr.gasLimit) : undefined,
      });
      setTxHash(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction rejected");
    }
  }

  return (
    <div className="panel">
      <h2>Fund from anywhere</h2>
      <p className="sub">
        Any token, any chain → USDC ready to trade on Derive. Powered by LI.FI +
        Privy, settled through the Arc USDC hub.
      </p>

      {!authenticated ? (
        <button className="btn block" onClick={login}>
          Connect to fund
        </button>
      ) : (
        <>
          <div className="grid cols-3" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>From chain</label>
              <select
                className="select"
                value={fromChainId}
                onChange={(e) => setFromChainId(Number(e.target.value))}
              >
                {SOURCES.map((c) => (
                  <option key={c} value={c}>
                    {CHAIN_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Token</label>
              <select
                className="select"
                value={fromToken}
                onChange={(e) => setFromToken(e.target.value as "usdc" | "native")}
              >
                <option value="usdc">USDC</option>
                <option value="native">Native (ETH)</option>
              </select>
            </div>
            <div className="field">
              <label>Amount (USDC)</label>
              <input
                className="input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>

          <button className="btn block" onClick={fetchQuote} disabled={loading}>
            {loading ? <IrisLoader /> : "Get route"}
          </button>

          {error && (
            <p className="err small" style={{ marginTop: 12 }}>
              {error}
            </p>
          )}

          {quote && (
            <div style={{ marginTop: 16 }}>
              <div className="flex between small">
                <span className="muted">You receive</span>
                <b>
                  {num(Number(quote.toAmount))} {quote.toTokenSymbol} on{" "}
                  {quote.toChainLabel}
                </b>
              </div>
              <div className="flex between small" style={{ marginTop: 6 }}>
                <span className="muted">Bridge + gas</span>
                <span>
                  ${quote.feeCostUsd} + ${quote.gasCostUsd}
                </span>
              </div>
              <div className="flex between small" style={{ marginTop: 6 }}>
                <span className="muted">Est. time</span>
                <span>~{Math.max(1, Math.round(quote.durationSec / 60))} min</span>
              </div>

              {quote.needsNativeBridge && (
                <div className="notice" style={{ marginTop: 12 }}>
                  Hop 2: bridge USDC from {quote.toChainLabel} → Derive Chain via
                  the native bridge (2–10 min). LI.FI delivers hop 1 in one tx.
                </div>
              )}

              <button
                className="btn block"
                style={{ marginTop: 14 }}
                onClick={execute}
              >
                Execute deposit
              </button>

              {txHash && (
                <p className="ok small mono" style={{ marginTop: 10 }}>
                  ✓ Submitted: {txHash.slice(0, 12)}…
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
