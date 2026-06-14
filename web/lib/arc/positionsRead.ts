/**
 * Unified per-wallet positions for the dashboard: the REAL vault positions
 * (CSP — collateral locked, premium paid on Arc) merged with the Derive-mirror
 * fills (covered call / buy call recorded on-chain). One normalized shape.
 */
import { createPublicClient, http } from "viem";
import { arcTestnet, ARC_RPC, ARC_EXPLORER, VAULT_ADDRESS, VAULT_ABI } from "./vault";
import { getArcPositions } from "./read";

export interface PositionView {
  source: "vault" | "derive";
  asset: string;
  label: string; // instrument or asset
  kind: string;
  strike: number;
  size: number;
  premium: number; // USDC
  collateral: number | null; // amount locked, in collateralAsset units (vault only)
  collateralAsset: string | null; // "USDC" (put) or the underlying (call)
  time: number; // unix seconds
  expiry: number;
  real: boolean; // true = user funds actually moved on-chain
}

const ASSET_BY_MARKET = ["ETH", "BTC", "SOL"];
const KIND_BY_ENUM = ["Cash-Secured Put", "Covered Call", "Buy Call"];

async function readVaultPositions(trader: string): Promise<PositionView[]> {
  const pub = createPublicClient({ chain: arcTestnet, transport: http(ARC_RPC) });
  const len = (await pub.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "positionsLength" })) as bigint;
  const n = Number(len);
  const out: PositionView[] = [];
  for (let i = 0; i < n; i++) {
    const p = (await pub.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "positions", args: [BigInt(i)] })) as readonly [
      string, number, number, bigint, bigint, bigint, bigint, bigint, bigint, boolean,
    ];
    if (p[0].toLowerCase() !== trader.toLowerCase()) continue;
    const asset = ASSET_BY_MARKET[p[2]] ?? `M${p[2]}`;
    const isCoveredCall = p[1] === 1;
    out.push({
      source: "vault",
      asset,
      label: asset,
      kind: KIND_BY_ENUM[p[1]] ?? `Kind ${p[1]}`,
      strike: Number(p[3]) / 1e8,
      size: Number(p[4]) / 1e18,
      // CSP collateral is USDC (6 dec); covered-call collateral is the
      // underlying (18 dec).
      collateral: isCoveredCall ? Number(p[5]) / 1e18 : Number(p[5]) / 1e6,
      collateralAsset: isCoveredCall ? asset : "USDC",
      premium: Number(p[6]) / 1e6,
      time: Number(p[7]),
      expiry: Number(p[8]),
      real: true,
    });
  }
  return out;
}

export async function getAllPositions(trader: string): Promise<{
  explorer: string;
  vault: string;
  positions: PositionView[];
  premiumTotal: number;
}> {
  const [vault, derive] = await Promise.all([
    readVaultPositions(trader).catch(() => []),
    getArcPositions(trader).then((r) => r.positions).catch(() => []),
  ]);
  const mirror: PositionView[] = derive.map((p) => ({
    source: "derive",
    asset: p.instrument.split("-")[0],
    label: p.instrument,
    kind: p.kind,
    strike: p.strike,
    size: p.size,
    premium: p.premium,
    collateral: null,
    collateralAsset: null,
    time: p.recordedAt,
    expiry: p.expiry,
    real: false,
  }));
  const positions = [...vault, ...mirror].sort((a, b) => b.time - a.time);
  const premiumTotal = positions.reduce((s, p) => s + (p.premium || 0), 0);
  return { explorer: ARC_EXPLORER, vault: VAULT_ADDRESS, positions, premiumTotal };
}
