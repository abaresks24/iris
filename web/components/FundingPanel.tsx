"use client";

import { useState } from "react";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import { parseUnits } from "viem";
import { CCTP_SOURCES, burnToArc, getAttestation, mintOnArc } from "@/lib/protocol/cctp";
import { composeDepositToArc } from "@/lib/protocol/lifiCompose";
import { arcTestnet } from "@/lib/protocol/arc";
import { IrisLoader } from "./IrisLoader";

const SOURCES = Object.entries(CCTP_SOURCES).map(([id, v]) => ({ id: Number(id), ...v }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cross-chain USDC funding into Arc via Circle CCTP V2.
 * (The action a LI.FI Composer Flow orchestrates on the source side.)
 */
export function FundingPanel() {
  const { address } = useAccount();
  const { data: wallet } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const [sourceId, setSourceId] = useState(SOURCES[0]?.id ?? 84532);
  const [amount, setAmount] = useState("10");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function oneTapComposer() {
    if (!wallet || !address) {
      setError("Connect a wallet first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStatus(`Switching to ${CCTP_SOURCES[sourceId].name}…`);
      await switchChainAsync({ chainId: sourceId });

      setStatus("Composing LI.FI Flow (swap → CCTP burn → Arc)…");
      const res = await composeDepositToArc({
        sourceChainId: sourceId,
        fromToken: CCTP_SOURCES[sourceId].usdc, // pay in USDC (or any token; swap leg handles it)
        amountWei: parseUnits(amount, 6),
        signer: address,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tr = (res as any).transactionRequest;
      if (!tr) throw new Error("Composer returned no transaction (check simulation).");

      setStatus("Submitting the composed transaction…");
      await wallet.sendTransaction({
        to: tr.to,
        data: tr.data,
        value: tr.value ? BigInt(tr.value) : undefined,
        account: address,
        chain: null,
      });
      setStatus("✓ Composed deposit submitted — CCTP mints USDC on Arc shortly.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Composer flow failed");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function bridge() {
    if (!wallet || !address) {
      setError("Connect a wallet first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStatus(`Switching to ${CCTP_SOURCES[sourceId].name}…`);
      await switchChainAsync({ chainId: sourceId });

      setStatus("Burning USDC on source (approve + depositForBurn)…");
      const burnTx = await burnToArc(wallet, address, sourceId, amount);

      setStatus("Waiting for Circle attestation… (1-2 min)");
      let att = null;
      for (let i = 0; i < 40 && !att; i++) {
        await sleep(5000);
        att = await getAttestation(sourceId, burnTx);
      }
      if (!att) throw new Error("Attestation timed out — retry mint later.");

      setStatus("Minting USDC on Arc…");
      await switchChainAsync({ chainId: arcTestnet.id });
      await mintOnArc(wallet, address, att.message, att.attestation);

      setStatus(`✓ ${amount} USDC delivered to Arc.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bridge failed");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>Fund from anywhere</h2>
      <p className="sub">
        Bring USDC into Arc from any CCTP chain — native burn &amp; mint via Circle. No wrapped tokens.
      </p>

      {!address ? (
        <div className="notice warn">Connect a wallet to fund.</div>
      ) : (
        <>
          <div className="grid cols-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>From chain</label>
              <select className="select" value={sourceId} onChange={(e) => setSourceId(Number(e.target.value))}>
                {SOURCES.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Amount (USDC)</label>
              <input className="input numeric" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </div>
          </div>

          <button className="btn block" onClick={oneTapComposer} disabled={busy}>
            {busy ? <IrisLoader /> : "⚡ One-tap deposit (LI.FI Composer)"}
          </button>
          <button className="btn ghost block" style={{ marginTop: 8 }} onClick={bridge} disabled={busy}>
            {busy ? <IrisLoader /> : "Bridge step-by-step (CCTP)"}
          </button>

          {status && <p className="small ok" style={{ marginTop: 12 }}>{status}</p>}
          {error && <p className="small err" style={{ marginTop: 12 }}>{error}</p>}

          <div className="notice" style={{ marginTop: 14 }}>
            Need test USDC on the source chain? <a href="https://faucet.circle.com" target="_blank" rel="noreferrer">Circle faucet →</a>
          </div>
        </>
      )}
    </div>
  );
}
