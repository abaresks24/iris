/**
 * Thin Derive REST client. Public endpoints need no auth; private endpoints
 * carry the X-Lyra* signature headers produced in auth.ts.
 */
import { config } from "../config.js";
import { restAuthHeaders } from "./auth.js";

const BASE = config.constants.restUrl;

export class DeriveApiError extends Error {
  constructor(
    public endpoint: string,
    public payload: unknown,
  ) {
    super(`Derive API error on ${endpoint}: ${JSON.stringify(payload)}`);
    this.name = "DeriveApiError";
  }
}

async function post<T>(
  endpoint: string,
  body: unknown,
  auth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (auth) {
    Object.assign(
      headers,
      await restAuthHeaders({
        walletAddress: config.owner,
        sessionPrivateKey: config.sessionPrivateKey,
      }),
    );
  }
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { result?: T; error?: unknown };
  if (json.error || !res.ok) {
    throw new DeriveApiError(endpoint, json.error ?? json);
  }
  return json.result as T;
}

// ─── Public market data ────────────────────────────────────────────────

export interface OptionDetails {
  index: string;
  expiry: number;
  strike: string;
  option_type: "C" | "P";
  settlement_price: string | null;
}

export interface Instrument {
  instrument_name: string;
  instrument_type: string;
  is_active: boolean;
  base_currency: string;
  quote_currency: string;
  base_asset_address: string;
  base_asset_sub_id: string;
  minimum_amount: string;
  amount_step: string;
  tick_size: string;
  taker_fee_rate: string;
  maker_fee_rate: string;
  base_fee: string;
  option_details: OptionDetails | null;
}

export interface Ticker extends Instrument {
  best_bid_price: string;
  best_ask_price: string;
  best_bid_amount: string;
  best_ask_amount: string;
  mark_price: string;
  index_price: string;
  min_price: string;
  max_price: string;
  open_interest: string;
  option_pricing: {
    delta: string;
    gamma: string;
    theta: string;
    vega: string;
    rho: string;
    iv: string;
    bid_iv: string;
    ask_iv: string;
    mark_price: string;
    forward_price: string;
  } | null;
}

export function getInstruments(params: {
  currency: string;
  instrument_type?: "option" | "perp" | "erc20";
  expired?: boolean;
}): Promise<Instrument[]> {
  return post<Instrument[]>("/public/get_instruments", {
    expired: false,
    instrument_type: "option",
    ...params,
  });
}

export function getTicker(instrument_name: string): Promise<Ticker> {
  return post<Ticker>("/public/get_ticker", { instrument_name });
}

// ─── Private (signed) ───────────────────────────────────────────────────

export interface PlaceOrderBody {
  instrument_name: string;
  direction: "buy" | "sell";
  order_type: "limit" | "market";
  time_in_force: "gtc" | "ioc" | "fok" | "post_only";
  mmp: boolean;
  subaccount_id: number;
  nonce: number;
  signer: string;
  signature_expiry_sec: number;
  signature: string;
  limit_price: string;
  amount: string;
  max_fee: string;
  label?: string;
}

export function placeOrder(body: PlaceOrderBody): Promise<unknown> {
  return post<unknown>("/private/order", body, true);
}

export function getSubaccount(subaccount_id: number): Promise<any> {
  return post<any>("/private/get_subaccount", { subaccount_id }, true);
}

export function getOpenOrders(subaccount_id: number): Promise<any> {
  return post<any>("/private/get_open_orders", { subaccount_id }, true);
}

export function getSubaccounts(): Promise<any> {
  return post<any>("/private/get_subaccounts", { wallet: config.owner }, true);
}

export function getTradeHistory(subaccount_id: number, page_size = 50): Promise<any> {
  return post<any>(
    "/private/get_trade_history",
    { subaccount_id, page_size },
    true,
  );
}
