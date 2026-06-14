/**
 * Read-side Arc client: reconstructs a trader's positions from the
 * DeriveSettlement contract (the on-chain record of Derive-matched fills).
 */
import { createPublicClient, http } from "viem";
import { arcChain } from "./settlement";

const SETTLEMENT_ADDRESS = (process.env.ARC_SETTLEMENT_ADDRESS ||
  "0xB01cfE8dA5e46c6c4754d196E90De1f93308d0f8") as `0x${string}`;
const EXPLORER = process.env.ARC_EXPLORER || "https://testnet.arcscan.app";
const RPC = process.env.ARC_RPC || "https://rpc.testnet.arc.network";

const ABI = [
  {
    type: "function",
    name: "traderFills",
    stateMutability: "view",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "fills",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
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
      { name: "recordedAt", type: "uint64" },
      { name: "settleSpot", type: "int256" },
      { name: "payoff", type: "uint256" },
      { name: "settled", type: "bool" },
    ],
  },
] as const;

const KIND_LABEL = ["Cash-Secured Put", "Covered Call", "Long Call"] as const;

export interface ArcPosition {
  id: number;
  kind: string;
  instrument: string;
  strike: number;
  size: number;
  premium: number;
  expiry: number;
  recordedAt: number;
  settled: boolean;
  payoff: number;
  deriveTradeId: string;
}

export async function getArcPositions(trader: string): Promise<{
  contract: string;
  explorer: string;
  positions: ArcPosition[];
}> {
  const pub = createPublicClient({ chain: arcChain, transport: http(RPC) });
  const ids = (await pub.readContract({
    address: SETTLEMENT_ADDRESS,
    abi: ABI,
    functionName: "traderFills",
    args: [trader as `0x${string}`],
  })) as bigint[];

  const positions = await Promise.all(
    ids.map(async (id) => {
      const f = (await pub.readContract({
        address: SETTLEMENT_ADDRESS,
        abi: ABI,
        functionName: "fills",
        args: [id],
      })) as readonly [
        string, number, string, string, string,
        bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, boolean,
      ];
      return {
        id: Number(id),
        kind: KIND_LABEL[f[1]] ?? `Kind ${f[1]}`,
        instrument: f[3],
        strike: Number(f[5]) / 1e8,
        size: Number(f[6]) / 1e18,
        premium: Number(f[8]) / 1e6,
        expiry: Number(f[9]),
        recordedAt: Number(f[10]),
        settled: f[13],
        payoff: Number(f[12]) / 1e6,
        deriveTradeId: f[4],
      } as ArcPosition;
    }),
  );

  return { contract: SETTLEMENT_ADDRESS, explorer: EXPLORER, positions };
}
