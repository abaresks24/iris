/**
 * Strategy layer — the "retail translation" on top of Derive's raw orderbook.
 *
 * Every preset is the SAME single-leg, fully-collateralised primitive
 * (one option, no margin maths). The preset only decides:
 *   - which option_type we look for (P vs C)
 *   - the direction (sell to earn premium, buy to take a view)
 *   - how we collateralise (USDC cash vs the underlying)
 *   - how we *frame* the economics for a non-options user.
 */
import type { Ticker } from "./client.js";

export type PresetId = "cash_secured_put" | "covered_call" | "long_call";

export interface PresetMeta {
  id: PresetId;
  label: string;
  optionType: "P" | "C";
  direction: "buy" | "sell";
  /** what the user locks up as collateral */
  collateral: "USDC" | "UNDERLYING";
  tagline: string;
}

export const PRESETS: Record<PresetId, PresetMeta> = {
  cash_secured_put: {
    id: "cash_secured_put",
    label: "Cash-Secured Put",
    optionType: "P",
    direction: "sell",
    collateral: "USDC",
    tagline: "Deposit USDC, earn yield. Worst case: you buy the asset cheaper.",
  },
  covered_call: {
    id: "covered_call",
    label: "Covered Call",
    optionType: "C",
    direction: "sell",
    collateral: "UNDERLYING",
    tagline: "Hold the asset, earn extra yield on top.",
  },
  long_call: {
    id: "long_call",
    label: "Buy Call",
    optionType: "C",
    direction: "buy",
    collateral: "USDC",
    tagline: "Bet the price goes up, with capped downside.",
  },
};

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
  /** per-contract premium quoted in USDC (received if selling, paid if buying) */
  premium: number;
  amount: number;
  /** total premium across `amount` contracts */
  premiumTotal: number;
  /** USDC (or underlying-notional) locked as collateral, total */
  collateralRequired: number;
  collateralAsset: "USDC" | "UNDERLYING";
  /** annualised yield for the income presets, null for long_call */
  aprPct: number | null;
  /** return over the option's life (premium / collateral), null for long_call */
  periodReturnPct: number | null;
  /** price at which the position breaks even */
  breakeven: number;
  /** the limit price we'll submit to cross the book */
  limitPrice: number;
  maxFee: number;
  isBid: boolean;
  liquid: boolean;
  summary: string;
}

function num(s: string | null | undefined): number {
  const n = Number(s ?? "0");
  return Number.isFinite(n) ? n : 0;
}

/**
 * Compute the full economics + executable order params for a preset against a
 * live ticker. `nowSec` is injected so the function stays pure/testable.
 */
export function computeEconomics(
  preset: PresetId,
  ticker: Ticker,
  amount: number,
  nowSec: number,
): Economics {
  const meta = PRESETS[preset];
  const det = ticker.option_details!;
  const strike = num(det.strike);
  const expiry = det.expiry;
  const daysToExpiry = Math.max((expiry - nowSec) / 86_400, 0);
  const tYears = daysToExpiry / 365;

  const index = num(ticker.index_price);
  const mark = num(ticker.mark_price) || num(ticker.option_pricing?.mark_price);
  const bestBid = num(ticker.best_bid_price);
  const bestAsk = num(ticker.best_ask_price);
  const iv = ticker.option_pricing ? num(ticker.option_pricing.iv) : null;

  const selling = meta.direction === "sell";
  const isBid = !selling;

  // Premium we expect: cross the book at the opposite top-of-book; fall back to
  // mark when the book is empty (common on testnet for far strikes).
  let premium: number;
  let liquid: boolean;
  if (selling) {
    liquid = bestBid > 0;
    premium = liquid ? bestBid : mark;
  } else {
    liquid = bestAsk > 0;
    premium = liquid ? bestAsk : mark;
  }

  // Limit price that crosses, clamped into the instrument's allowed band.
  const minP = num(ticker.min_price);
  const maxP = num(ticker.max_price);
  const clamp = (p: number) => Math.min(Math.max(p, minP || 0), maxP || p);
  const limitPrice = selling
    ? clamp(liquid ? bestBid : Math.max(mark, minP))
    : clamp(liquid ? bestAsk : Math.max(mark, minP) || maxP);

  const premiumTotal = premium * amount;

  // Collateral.
  let collateralRequired: number;
  if (preset === "cash_secured_put") {
    collateralRequired = strike * amount; // must be able to buy at the strike
  } else if (preset === "covered_call") {
    collateralRequired = index * amount; // notional value of the held underlying
  } else {
    collateralRequired = premiumTotal; // long call: you only risk the premium
  }

  // Yield framing (income presets only).
  let aprPct: number | null = null;
  let periodReturnPct: number | null = null;
  if (preset !== "long_call" && collateralRequired > 0 && tYears > 0) {
    periodReturnPct = (premiumTotal / collateralRequired) * 100;
    aprPct = (premiumTotal / collateralRequired) * (365 / daysToExpiry) * 100;
  }

  // Breakeven.
  let breakeven: number;
  if (preset === "cash_secured_put") breakeven = strike - premium;
  else if (preset === "covered_call") breakeven = index - premium; // on the held asset
  else breakeven = strike + premium;

  // Fee cap: generous buffer over the estimated taker fee.
  const notional = (mark || index || premium) * amount;
  const estFee = num(ticker.base_fee) + num(ticker.taker_fee_rate) * notional;
  const maxFee = Math.max(estFee * 3, 1);

  const summary =
    preset === "cash_secured_put"
      ? `Lock ${fmt(collateralRequired)} USDC, collect ${fmt(premiumTotal)} USDC now (${pct(
          aprPct,
        )} APR). If ${ticker.base_currency} stays above ${fmt(
          strike,
        )} you keep it all; below, you buy ${ticker.base_currency} at an effective ${fmt(
          breakeven,
        )}.`
      : preset === "covered_call"
        ? `Hold ${amount} ${ticker.base_currency}, collect ${fmt(
            premiumTotal,
          )} USDC now (${pct(aprPct)} APR). Capped if ${ticker.base_currency} rises above ${fmt(
            strike,
          )}.`
        : `Pay ${fmt(premiumTotal)} USDC for upside on ${ticker.base_currency} above ${fmt(
            strike,
          )}. Profit past ${fmt(breakeven)}; most you can lose is the premium.`;

  return {
    preset,
    instrumentName: ticker.instrument_name,
    currency: ticker.base_currency,
    strike,
    expiry,
    daysToExpiry,
    indexPrice: index,
    markPrice: mark,
    iv,
    premium,
    amount,
    premiumTotal,
    collateralRequired,
    collateralAsset: meta.collateral,
    aprPct,
    periodReturnPct,
    breakeven,
    limitPrice,
    maxFee,
    isBid,
    liquid,
    summary,
  };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function pct(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(1)}%`;
}
