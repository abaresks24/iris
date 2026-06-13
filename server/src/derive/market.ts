/**
 * Market selection helpers — turn "I want a cash-secured put on ETH" into a
 * concrete short list of live instruments with computed economics, without the
 * user ever seeing a strike grid. This is what makes options feel retail.
 */
import { getInstruments, getTicker, type Instrument } from "./client.js";
import {
  computeEconomics,
  PRESETS,
  type Economics,
  type PresetId,
} from "./strategy.js";

interface Parsed {
  inst: Instrument;
  strike: number;
  expiry: number;
  type: "C" | "P";
  daysToExpiry: number;
}

function parse(inst: Instrument, nowSec: number): Parsed | null {
  const d = inst.option_details;
  if (!d) return null;
  return {
    inst,
    strike: Number(d.strike),
    expiry: d.expiry,
    type: d.option_type,
    daysToExpiry: (d.expiry - nowSec) / 86_400,
  };
}

/** Pick the listed expiry closest to `targetDays` but at least `minDays` out. */
function pickExpiry(parsed: Parsed[], targetDays: number, minDays: number): number | null {
  const expiries = [...new Set(parsed.filter((p) => p.daysToExpiry >= minDays).map((p) => p.expiry))];
  if (!expiries.length) return null;
  let best = expiries[0];
  let bestDiff = Infinity;
  const nowSec = Date.now() / 1000;
  for (const e of expiries) {
    const days = (e - nowSec) / 86_400;
    const diff = Math.abs(days - targetDays);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = e;
    }
  }
  return best;
}

/** Cheaply read the spot/index price by sampling one ticker. */
async function getIndexPrice(sample: Instrument): Promise<number> {
  const t = await getTicker(sample.instrument_name);
  return Number(t.index_price) || Number(t.option_pricing?.forward_price) || 0;
}

export interface StrategyCandidates {
  preset: PresetId;
  currency: string;
  indexPrice: number;
  expiry: number;
  daysToExpiry: number;
  candidates: Economics[];
}

/**
 * Return a handful of attractive instruments for a preset, each with full
 * economics. Sorted so the most relevant choice is first.
 */
export async function listStrategyCandidates(
  preset: PresetId,
  currency: string,
  amount: number,
  opts: { targetDays?: number; minDays?: number; count?: number } = {},
): Promise<StrategyCandidates> {
  const { targetDays = 30, minDays = 4, count = 5 } = opts;
  const meta = PRESETS[preset];
  const nowSec = Date.now() / 1000;

  const instruments = await getInstruments({ currency, instrument_type: "option" });
  const parsed = instruments
    .map((i) => parse(i, nowSec))
    .filter((p): p is Parsed => !!p && p.inst.is_active && p.type === meta.optionType);

  if (!parsed.length) {
    return { preset, currency, indexPrice: 0, expiry: 0, daysToExpiry: 0, candidates: [] };
  }

  const expiry = pickExpiry(parsed, targetDays, minDays);
  if (!expiry) {
    return { preset, currency, indexPrice: 0, expiry: 0, daysToExpiry: 0, candidates: [] };
  }
  const atExpiry = parsed.filter((p) => p.expiry === expiry);

  // Need the index to choose moneyness. Sample the middle-strike instrument.
  const mid = atExpiry[Math.floor(atExpiry.length / 2)];
  const indexPrice = await getIndexPrice(mid.inst);

  // Target moneyness per preset.
  const target =
    preset === "cash_secured_put"
      ? indexPrice * 0.92 // OTM put: willing to buy ~8% lower
      : preset === "covered_call"
        ? indexPrice * 1.08 // OTM call: cap ~8% higher
        : indexPrice * 1.03; // long call: slightly OTM

  const ranked = atExpiry
    .filter((p) => p.strike > 0)
    .sort((a, b) => Math.abs(a.strike - target) - Math.abs(b.strike - target))
    .slice(0, count);

  const tickers = await Promise.all(ranked.map((p) => getTicker(p.inst.instrument_name)));
  const candidates = tickers
    .map((t) => computeEconomics(preset, t, amount, nowSec))
    .sort((a, b) => {
      // Prefer liquid, then higher APR (income) / closer to target (long call).
      if (a.liquid !== b.liquid) return a.liquid ? -1 : 1;
      if (preset === "long_call")
        return Math.abs(a.strike - target) - Math.abs(b.strike - target);
      return (b.aprPct ?? 0) - (a.aprPct ?? 0);
    });

  return {
    preset,
    currency,
    indexPrice,
    expiry,
    daysToExpiry: (expiry - nowSec) / 86_400,
    candidates,
  };
}
