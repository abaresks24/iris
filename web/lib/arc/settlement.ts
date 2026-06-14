/**
 * Arc on-chain settlement client.
 *
 * After a fill is matched on Derive's orderbook (real off-chain trade), we
 * book it on-chain in the DeriveSettlement contract on Arc — a settlement tx
 * that SUCCEEDS (Arc's Chainlink feeds are live), unlike Derive's testnet
 * settlement which reverts. This is what gives the demo a real, verifiable
 * on-chain settlement trace.
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  keccak256,
  toHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PresetId } from "../derive/strategy";

const ZERO_KEY = ("0x" + "0".repeat(64)) as Hex;

const RPC = process.env.ARC_RPC || "https://5042002.rpc.thirdweb.com";
const EXPLORER = process.env.ARC_EXPLORER || "https://testnet.arcscan.app";
const SETTLEMENT_ADDRESS = (process.env.ARC_SETTLEMENT_ADDRESS ||
  "0xB01cfE8dA5e46c6c4754d196E90De1f93308d0f8") as `0x${string}`;
const ETH_FEED = (process.env.ARC_ETH_FEED ||
  "0x81C445E289687efD51EAbc5ffD8a0B84c63C471d") as `0x${string}`;
const SETTLEMENT_KEY = (process.env.ARC_SETTLEMENT_PRIVATE_KEY || ZERO_KEY) as Hex;

export const arcChain = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Arcscan", url: EXPLORER } },
});

const RECORD_ABI = [
  {
    type: "function",
    name: "record",
    stateMutability: "nonpayable",
    inputs: [
      { name: "trader", type: "address" },
      { name: "kind", type: "uint8" },
      { name: "feed", type: "address" },
      { name: "instrument", type: "string" },
      { name: "deriveTradeId", type: "bytes32" },
      { name: "strike", type: "uint256" },
      { name: "size", type: "uint256" },
      { name: "tradePrice", type: "uint256" },
      { name: "premium", type: "uint256" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
] as const;

/** preset → on-chain Kind enum (CASH_SECURED_PUT=0, COVERED_CALL=1, LONG_CALL=2). */
const KIND: Record<PresetId, number> = {
  cash_secured_put: 0,
  covered_call: 1,
  long_call: 2,
};

export const arcSettlementEnabled = SETTLEMENT_KEY !== ZERO_KEY;

export interface ArcSettlementInput {
  trader: `0x${string}`;
  preset: PresetId;
  instrument: string;
  deriveTradeId: string; // Derive matcher trade_id (UUID); hashed to bytes32
  strike: number; // USD, human (e.g. 1800)
  size: number; // contracts (e.g. 1)
  premiumPerUnit: number; // USDC, human (e.g. 158.4)
  premiumTotal: number; // USDC, human
  expiry: number; // unix seconds
}

export interface ArcSettlementResult {
  txHash: string;
  explorerUrl: string;
  contract: string;
  chainId: number;
}

function toUsdc6(human: number): bigint {
  return BigInt(Math.round(human * 1e6));
}
function toFeed8(human: number): bigint {
  return BigInt(Math.round(human * 1e8));
}
function to1e18(human: number): bigint {
  return BigInt(Math.round(human * 1e18));
}

/**
 * Book a Derive-matched fill on-chain on Arc. Returns the (successful)
 * settlement tx hash + explorer link. Throws on RPC/contract failure — callers
 * treat Arc settlement as best-effort so a failure never blocks the trade.
 */
export async function recordFillOnArc(
  input: ArcSettlementInput,
): Promise<ArcSettlementResult> {
  if (!arcSettlementEnabled) throw new Error("ARC_SETTLEMENT_PRIVATE_KEY not set");

  const account = privateKeyToAccount(SETTLEMENT_KEY);
  const wallet = createWalletClient({ account, chain: arcChain, transport: http(RPC) });
  const pub = createPublicClient({ chain: arcChain, transport: http(RPC) });

  const tradeIdBytes32 = keccak256(toHex(input.deriveTradeId));

  const hash = await wallet.writeContract({
    address: SETTLEMENT_ADDRESS,
    abi: RECORD_ABI,
    functionName: "record",
    args: [
      input.trader,
      KIND[input.preset],
      ETH_FEED,
      input.instrument,
      tradeIdBytes32,
      toFeed8(input.strike),
      to1e18(input.size),
      toUsdc6(input.premiumPerUnit),
      toUsdc6(input.premiumTotal),
      BigInt(Math.floor(input.expiry)),
    ],
  });

  // Wait for inclusion so we can confirm success and surface a real trace.
  await pub.waitForTransactionReceipt({ hash, timeout: 30_000 });

  return {
    txHash: hash,
    explorerUrl: `${EXPLORER}/tx/${hash}`,
    contract: SETTLEMENT_ADDRESS,
    chainId: arcChain.id,
  };
}
