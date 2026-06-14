"use client";

import { useState } from "react";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import { CCTP_SOURCES, burnToArc, getAttestation, mintOnArc } from "@/lib/protocol/cctp";
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

          <button className="btn block" onClick={bridge} disabled={busy}>
            {busy ? <IrisLoader /> : "Bridge to Arc →"}
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
