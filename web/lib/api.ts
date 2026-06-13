/** Typed client for our Derive signer backend. */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8799";

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
  trade: (body: { preset: PresetId; instrumentName: string; amount: number }) =>
    post<{ economics: Economics; order: unknown }>("/api/trade", body),
  account: () => get<any>("/api/account"),
  history: () => get<any>("/api/history"),
};
