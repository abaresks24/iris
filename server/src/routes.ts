import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { config } from "./config.js";
import {
  getInstruments,
  getTicker,
  getSubaccount,
  getOpenOrders,
  getTradeHistory,
} from "./derive/client.js";
import { listStrategyCandidates } from "./derive/market.js";
import { PRESETS, type PresetId } from "./derive/strategy.js";
import { placeStrategyOrder } from "./derive/trade.js";

export const api = Router();

const asyncH =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) => {
    fn(req, res).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[api] ${req.method} ${req.path} →`, message);
      res.status(400).json({ error: message });
    });
  };

api.get("/health", (_req, res) => {
  res.json({
    ok: true,
    env: config.env,
    restUrl: config.constants.restUrl,
    tradingEnabled: config.tradingEnabled,
    subaccountId: config.tradingEnabled ? config.subaccountId : null,
  });
});

api.get("/presets", (_req, res) => {
  res.json({ presets: Object.values(PRESETS) });
});

const PresetParam = z.enum(["cash_secured_put", "covered_call", "long_call"]);

api.get(
  "/strategies/:preset",
  asyncH(async (req, res) => {
    const preset = PresetParam.parse(req.params.preset) as PresetId;
    const currency = (req.query.currency as string) || "ETH";
    const amount = Number(req.query.amount ?? 1) || 1;
    const result = await listStrategyCandidates(preset, currency.toUpperCase(), amount);
    res.json(result);
  }),
);

api.get(
  "/instruments",
  asyncH(async (req, res) => {
    const currency = ((req.query.currency as string) || "ETH").toUpperCase();
    const instruments = await getInstruments({ currency, instrument_type: "option" });
    res.json({ currency, count: instruments.length, instruments });
  }),
);

api.get(
  "/ticker/:instrument",
  asyncH(async (req, res) => {
    const ticker = await getTicker(req.params.instrument);
    res.json(ticker);
  }),
);

const TradeBody = z.object({
  preset: PresetParam,
  instrumentName: z.string().min(3),
  amount: z.number().positive(),
  limitPrice: z.number().positive().optional(),
});

api.post(
  "/trade",
  asyncH(async (req, res) => {
    const body = TradeBody.parse(req.body);
    const result = await placeStrategyOrder(body as any);
    res.json(result);
  }),
);

api.get(
  "/account",
  asyncH(async (_req, res) => {
    if (!config.tradingEnabled) {
      return res.json({ tradingEnabled: false });
    }
    const [subaccount, openOrders] = await Promise.all([
      getSubaccount(config.subaccountId),
      getOpenOrders(config.subaccountId).catch(() => null),
    ]);
    res.json({ tradingEnabled: true, subaccount, openOrders });
  }),
);

api.get(
  "/history",
  asyncH(async (_req, res) => {
    if (!config.tradingEnabled) {
      return res.json({ tradingEnabled: false, trades: [] });
    }
    const history = await getTradeHistory(config.subaccountId);
    res.json({ tradingEnabled: true, ...history });
  }),
);
