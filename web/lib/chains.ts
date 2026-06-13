import { defineChain } from "viem";
import { arbitrum, base, mainnet, optimism } from "viem/chains";

export const DERIVE_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_DERIVE_CHAIN_ID ?? 957,
);

/** Derive Chain — OP-Stack L2 where options settle in USDC. */
export const deriveChain = defineChain({
  id: DERIVE_CHAIN_ID,
  name: "Derive Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_DERIVE_RPC ?? "https://rpc.lyra.finance"],
    },
  },
  blockExplorers: {
    default: { name: "Derive Explorer", url: "https://explorer.lyra.finance" },
  },
});

/** Chains a user might fund FROM (the "from anywhere" side of the funnel). */
export const sourceChains = [arbitrum, optimism, base, mainnet] as const;

export const supportedChains = [
  deriveChain,
  arbitrum,
  optimism,
  base,
  mainnet,
] as const;
