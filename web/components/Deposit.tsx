"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useAccount, useSwitchChain, useWriteContract, usePublicClient } from "wagmi";
import { arcTestnet, VAULT_ADDRESS, USDC_ADDRESS, USDC_ABI, toUsdc6 } from "@/lib/arc/vault";
import { IrisLoader } from "./IrisLoader";

const MAX_UINT = (2n ** 256n - 1n);

/**
 * One-click "Deposit": funds the connected wallet on Arc to trade — tops up
 * native gas, mints test USDC, and pre-approves the vault. After this, opening
 * a position is a single transaction.
 */
export function Deposit({ variant = "btn" }: { variant?: "btn" | "btn secondary" }) {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const arc = usePublicClient({ chainId: arcTestnet.id });

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("10000");
  const [step, setStep] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  if (!authenticated) return null;
  const acct = (address ?? wallets[0]?.address) as `0x${string}` | undefined;

  async function fund() {
    if (!acct || !arc) { setErr("Connect your wallet first"); return; }
    setErr(""); setDone(false);
    try {
      const amt = toUsdc6(Number(amount) || 0);
      setStep("Switching to Arc…");
      await switchChainAsync({ chainId: arcTestnet.id });
      setStep("Topping up gas…");
      await fetch("/api/gas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: acct }) }).catch(() => {});
      setStep("Minting test USDC…");
      let h = await writeContractAsync({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "mint", args: [acct, amt], chainId: arcTestnet.id });
      await arc.waitForTransactionReceipt({ hash: h });
      setStep("Approving the vault…");
      h = await writeContractAsync({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "approve", args: [VAULT_ADDRESS, MAX_UINT], chainId: arcTestnet.id });
      await arc.waitForTransactionReceipt({ hash: h });
      setStep(""); setDone(true);
    } catch (e: any) {
      setStep("");
      setErr(e?.shortMessage || (e instanceof Error ? e.message : "Failed"));
    }
  }

  return (
    <>
      <button className={variant} onClick={() => { setOpen(true); setDone(false); setErr(""); }}>
        Deposit
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>Deposit to trade</h3>
            <p className="muted small" style={{ margin: "4px 0 0" }}>
              Fund your wallet on Arc in one click — we top up gas, mint test USDC,
              and pre-approve the vault so opening a position is a single tx.
            </p>
            <div className="field" style={{ margin: "16px 0" }}>
              <label>Amount (test USDC)</label>
              <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </div>
            {step ? <p className="muted small flex" style={{ gap: 8 }}><IrisLoader size={14} /> {step}</p> : null}
            {err ? <p className="err small">{err}</p> : null}
            {done ? <p className="ok small">✓ Funded — head to <a href="/app/earn">Earn</a> to open a position.</p> : null}
            <div className="flex between" style={{ marginTop: 14 }}>
              <button className="btn secondary" onClick={() => setOpen(false)}>Close</button>
              <button className="btn" onClick={fund} disabled={!!step}>
                {step ? <IrisLoader /> : `Deposit ${amount} USDC`}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
