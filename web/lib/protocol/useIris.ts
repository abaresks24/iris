"use client";

/**
 * Drop-in hook for the front. Wraps the protocol SDK with the connected
 * wallet (wagmi/Privy). Your UI just calls these — no plumbing left.
 *
 *   const iris = useIris();
 *   const q = await iris.quotePut(2800, 1, expirySec);
 *   await iris.openPut(2800, 1, expirySec);
 */
import { useAccount, useWalletClient } from "wagmi";
import type { Address } from "viem";
import * as vault from "./vault";

export function useIris() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const ready = Boolean(address && walletClient);

  return {
    address: address as Address | undefined,
    ready,

    // reads (no wallet needed)
    getSpotUsd: vault.getSpotUsd,
    quotePut: vault.quotePut,
    quoteCall: vault.quoteCall,
    getPositions: (writer?: Address) => vault.getPositions(writer ?? address),
    getBalances: () => (address ? vault.getBalances(address) : Promise.resolve({ usdc: 0, weth: 0 })),

    // writes (require a connected wallet)
    openPut: (strikeUsd: number, sizeEth: number, expirySec: number) => {
      if (!walletClient || !address) throw new Error("connect a wallet");
      return vault.openPut(walletClient, address, strikeUsd, sizeEth, expirySec);
    },
    openCall: (strikeUsd: number, sizeEth: number, expirySec: number) => {
      if (!walletClient || !address) throw new Error("connect a wallet");
      return vault.openCall(walletClient, address, strikeUsd, sizeEth, expirySec);
    },
    settle: (id: number) => {
      if (!walletClient || !address) throw new Error("connect a wallet");
      return vault.settle(walletClient, address, id);
    },
    mintTestWeth: (amountEth: number) => {
      if (!walletClient || !address) throw new Error("connect a wallet");
      return vault.mintTestWeth(walletClient, address, amountEth);
    },
  };
}
