/**
 * LI.FI integration — quote a real cross-chain route that turns "any token on
 * any chain" into USDC, the collateral Derive settles in.
 *
 * The full funnel is two hops:
 *   1. LI.FI: source token/chain  → USDC on an OP-Stack L2 (one tx, swap+bridge)
 *   2. Derive native bridge:       USDC on the L2 → USDC on Derive Chain (957)
 *
 * We try to quote straight to Derive Chain first; if LI.FI doesn't yet route to
 * 957 we fall back to Optimism USDC and surface hop 2 as the native-bridge step.
 */
import { createConfig, getQuote, type QuoteRequest } from "@lifi/sdk";
import { DERIVE_CHAIN_ID } from "./chains";

let configured = false;
function ensureConfig() {
  if (configured) return;
  createConfig({
    integrator: process.env.NEXT_PUBLIC_LIFI_INTEGRATOR ?? "iris",
    apiKey: process.env.NEXT_PUBLIC_LIFI_API_KEY || undefined,
  });
  configured = true;
}

/** Canonical USDC addresses per supported source chain. */
export const USDC: Record<number, `0x${string}`> = {
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Ethereum
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Optimism
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
};

export const CHAIN_LABEL: Record<number, string> = {
  1: "Ethereum",
  42161: "Arbitrum",
  10: "Optimism",
  8453: "Base",
};

export interface FundingQuote {
  toChainId: number;
  toChainLabel: string;
  toTokenSymbol: string;
  fromAmountUsd: string;
  toAmount: string; // human USDC out
  gasCostUsd: string;
  feeCostUsd: string;
  durationSec: number;
  steps: string[];
  needsNativeBridge: boolean;
  transactionRequest: any;
}

const NATIVE = "0x0000000000000000000000000000000000000000";

export async function getFundingQuote(params: {
  fromChainId: number;
  fromToken?: "native" | "usdc";
  amountUsdc: string; // human, USDC units
  fromAddress: string;
}): Promise<FundingQuote> {
  ensureConfig();

  const fromToken =
    params.fromToken === "native" ? NATIVE : USDC[params.fromChainId];
  // USDC has 6 decimals.
  const fromAmount = BigInt(
    Math.round(parseFloat(params.amountUsdc || "0") * 1e6),
  ).toString();

  async function quoteTo(toChainId: number): Promise<FundingQuote> {
    const toToken =
      toChainId === DERIVE_CHAIN_ID
        ? (process.env.NEXT_PUBLIC_DERIVE_USDC as string) || USDC[10]
        : USDC[toChainId];

    const req: QuoteRequest = {
      fromChain: params.fromChainId,
      toChain: toChainId,
      fromToken,
      toToken,
      fromAmount,
      fromAddress: params.fromAddress,
    };
    const q = await getQuote(req);
    const est = q.estimate;
    const gasUsd = (q.estimate.gasCosts ?? []).reduce(
      (s, g) => s + Number(g.amountUSD ?? 0),
      0,
    );
    const feeUsd = (q.estimate.feeCosts ?? []).reduce(
      (s, f) => s + Number(f.amountUSD ?? 0),
      0,
    );
    return {
      toChainId,
      toChainLabel:
        toChainId === DERIVE_CHAIN_ID ? "Derive Chain" : CHAIN_LABEL[toChainId],
      toTokenSymbol: q.action.toToken.symbol,
      fromAmountUsd: est.fromAmountUSD ?? params.amountUsdc,
      toAmount: (Number(est.toAmount) / 1e6).toFixed(2),
      gasCostUsd: gasUsd.toFixed(2),
      feeCostUsd: feeUsd.toFixed(2),
      durationSec: est.executionDuration ?? 0,
      steps: [q.toolDetails?.name ? `Bridge via ${q.toolDetails.name}` : "Bridge"],
      needsNativeBridge: toChainId !== DERIVE_CHAIN_ID,
      transactionRequest: q.transactionRequest,
    };
  }

  // Try straight to Derive Chain, fall back to Optimism USDC + native bridge hop.
  try {
    return await quoteTo(DERIVE_CHAIN_ID);
  } catch {
    return await quoteTo(10);
  }
}
