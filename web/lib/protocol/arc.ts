import { createPublicClient, defineChain, http } from "viem";

/** Arc testnet — Circle's stablechain (gas paid in USDC). */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, // gas token
  rpcUrls: { default: { http: ["https://5042002.rpc.thirdweb.com"] } },
  blockExplorers: { default: { name: "Arcscan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});

/** Deployed Iris protocol on Arc testnet. */
export const ADDR = {
  optionVault: "0x79B66d067e669a8Cd68eA68300d7B55110CD7449",
  ethUsdFeed: "0x81C445E289687efD51EAbc5ffD8a0B84c63C471d",
  weth: "0xCbCa2596d3C5986AD90f29Fc449b7F11a00CA528",
  usdc: "0x3600000000000000000000000000000000000000", // native USDC (6-dec ERC20)
} as const;

/** Circle CCTP V2 on Arc testnet (for cross-chain USDC deposits). */
export const CCTP = {
  tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
  messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
  arcDomain: 26,
} as const;

/** Read-only client for Arc. */
export const arcClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

export const USDC_DECIMALS = 6;
export const ETH_MARKET_ID = 0;
