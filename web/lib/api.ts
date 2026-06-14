/** Typed client for our Derive signer backend. */
// Empty default → relative /api/* (the Next API routes in this same app).
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export type PresetId = "cash_secured_put" | "covered_call" | "long_call";

export interface PresetMeta {
  id: PresetId;
  label: string;
  optionType: "P" | "C";
  direction: "buy" | "sell";
  collateral: "USDC" | "UNDERLYING";
  tagline: string;
}

export interface Economics {
  preset: PresetId;
  instrumentName: string;
  currency: string;
  strike: number;
  expiry: number;
  daysToExpiry: number;
  indexPrice: number;
  markPrice: number;
  iv: number | null;
  premium: number;
  amount: number;
  premiumTotal: number;
  collateralRequired: number;
  collateralAsset: "USDC" | "UNDERLYING";
  aprPct: number | null;
  periodReturnPct: number | null;
  breakeven: number;
  limitPrice: number;
  maxFee: number;
  isBid: boolean;
  liquid: boolean;
  summary: string;
}

export interface StrategyCandidates {
  preset: PresetId;
  currency: string;
  indexPrice: number;
  expiry: number;
  daysToExpiry: number;
  candidates: Economics[];
}

export interface ArcSettlement {
  txHash: string;
  explorerUrl: string;
  contract: string;
  chainId: number;
}

export interface Health {
  ok: boolean;
  env: string;
  restUrl: string;
  tradingEnabled: boolean;
  subaccountId: number | null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `GET ${path} failed`);
  return json as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `POST ${path} failed`);
  return json as T;
}

export const api = {
  health: () => get<Health>("/api/health"),
  presets: () => get<{ presets: PresetMeta[] }>("/api/presets"),
  strategies: (preset: PresetId, currency = "ETH", amount = 1) =>
    get<StrategyCandidates>(
      `/api/strategies/${preset}?currency=${currency}&amount=${amount}`,
    ),
  trade: (body: {
    preset: PresetId;
    instrumentName: string;
    amount: number;
    trader?: string;
  }) =>
    post<{
      economics: Economics;
      order: unknown;
      filled?: boolean;
      arcSettlement?: ArcSettlement | { error: string };
    }>("/api/trade", body),
  account: () => get<any>("/api/account"),
  history: () => get<any>("/api/history"),
  arcPositions: (trader: string) =>
    get<{ contract: string; explorer: string; positions: ArcPosition[] }>(
      `/api/arc/positions?trader=${trader}`,
    ),
  positions: (trader: string) =>
    get<{ explorer: string; vault: string; positions: PositionView[]; premiumTotal: number }>(
      `/api/positions?trader=${trader}`,
    ),
};

export interface PositionView {
  source: "vault" | "derive";
  asset: string;
  label: string;
  kind: string;
  strike: number;
  size: number;
  premium: number;
  collateral: number | null;
  time: number;
  expiry: number;
  real: boolean;
}

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
