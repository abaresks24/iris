/**
 * Iris OptionVault on Arc — the real, per-user execution layer.
 * Client-safe constants + ABIs (used by wagmi writes and the server reader).
 * Derive provides live prices/APRs in the UI; here is where money actually
 * moves: deposit collateral, receive premium, settle on-chain via Chainlink.
 */
import { defineChain } from "viem";

export const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC || "https://rpc.testnet.arc.network";
export const ARC_EXPLORER = "https://testnet.arcscan.app";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  // Native gas token is USDC but the EVM native balance is 18-decimal wei.
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC] } },
  blockExplorers: { default: { name: "Arcscan", url: ARC_EXPLORER } },
});

export const VAULT_ADDRESS = "0xFEE4D91B99Cc6f0BE467C747b1E1AB97822B99dD" as const;
export const USDC_ADDRESS = "0xB0b445C8F7caD2eB2152751733dF1854AC14237c" as const;

/** Earn explorer currency → vault marketId. */
export const MARKET_ID: Record<string, number> = { ETH: 0, BTC: 1, SOL: 2 };

/** Covered-call collateral token per asset (mintable test underlyings, 18-dec). */
export const UNDERLYING_BY_CURRENCY: Record<string, `0x${string}`> = {
  ETH: "0x8d030C0349A5cb461f34Dc9B4aAD33275daDb370",
  BTC: "0x5e9DC692072fc9d39f11751C2dA15b1063E6483e",
  SOL: "0x17C3a14d7A79f75653DEEB214c9477439C19577e",
};

export const USDC_ABI = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export const VAULT_ABI = [
  {
    type: "function", name: "quoteCashSecuredPut", stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint8" }, { name: "strike", type: "uint256" }, { name: "size", type: "uint256" }, { name: "expiry", type: "uint64" }],
    outputs: [{ name: "collateral", type: "uint256" }, { name: "premium", type: "uint256" }],
  },
  {
    type: "function", name: "openCashSecuredPut", stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint8" }, { name: "strike", type: "uint256" }, { name: "size", type: "uint256" }, { name: "expiry", type: "uint64" }],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function", name: "quoteCoveredCall", stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint8" }, { name: "size", type: "uint256" }, { name: "expiry", type: "uint64" }],
    outputs: [{ name: "collateral", type: "uint256" }, { name: "premium", type: "uint256" }],
  },
  {
    type: "function", name: "openCoveredCall", stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint8" }, { name: "strike", type: "uint256" }, { name: "size", type: "uint256" }, { name: "expiry", type: "uint64" }],
    outputs: [{ name: "id", type: "uint256" }],
  },
  { type: "function", name: "positionsLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "positions", stateMutability: "view", inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "writer", type: "address" }, { name: "kind", type: "uint8" }, { name: "marketId", type: "uint8" },
      { name: "strike", type: "uint256" }, { name: "size", type: "uint256" }, { name: "collateral", type: "uint256" },
      { name: "premium", type: "uint256" }, { name: "openedAt", type: "uint64" }, { name: "expiry", type: "uint64" }, { name: "settled", type: "bool" },
    ],
  },
] as const;

/** strike (human USD) → feed decimals (1e8). */
export const toFeed8 = (n: number) => BigInt(Math.round(n * 1e8));
/** size (contracts) → 1e18. */
export const toSize18 = (n: number) => BigInt(Math.round(n * 1e18));
/** USDC (human) → 6 dec. */
export const toUsdc6 = (n: number) => BigInt(Math.round(n * 1e6));
