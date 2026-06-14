"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useFunding } from "@/app/providers";
import { shortAddr } from "@/lib/format";

function PrivyConnect() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const addr = wallets[0]?.address ?? user?.wallet?.address;

  if (!ready) return <span className="muted small">…</span>;

  if (!authenticated) {
    return (
      <button className="btn" onClick={login}>
        Connect
      </button>
    );
  }

  return (
    <div className="wallet-pill">
      <span className="wallet-dot" />
      <span className="mono">{shortAddr(addr)}</span>
      <button className="wallet-x" onClick={logout} title="Disconnect">×</button>
    </div>
  );
}

export function ConnectButton() {
  const { privyEnabled } = useFunding();
  if (!privyEnabled) {
    return <span className="badge warn">set NEXT_PUBLIC_PRIVY_APP_ID</span>;
  }
  return <PrivyConnect />;
}
