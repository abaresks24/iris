"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { useWallets } from "@privy-io/react-auth";
import { arcTestnet, USDC_ADDRESS, USDC_ABI } from "./vault";

/** Live test-USDC balance + native gas of the connected wallet on Arc. */
export function useArcBalance() {
  const { address } = useAccount();
  const { wallets } = useWallets();
  const acct = (address ?? wallets[0]?.address) as `0x${string}` | undefined;
  const pub = usePublicClient({ chainId: arcTestnet.id });

  const [usdc, setUsdc] = useState<number | null>(null);
  const [gas, setGas] = useState<number | null>(null);

  const refetch = useCallback(async () => {
    if (!acct || !pub) return;
    try {
      const [b, n] = await Promise.all([
        pub.readContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: "balanceOf", args: [acct] }) as Promise<bigint>,
        pub.getBalance({ address: acct }),
      ]);
      setUsdc(Number(b) / 1e6);
      setGas(Number(n) / 1e18);
    } catch { /* ignore transient RPC errors */ }
  }, [acct, pub]);

  useEffect(() => {
    refetch();
    const t = setInterval(refetch, 6000);
    return () => clearInterval(t);
  }, [refetch]);

  return { usdc, gas, acct, refetch };
}
