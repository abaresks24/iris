/**
 * The end-to-end "place a strategy order" service: resolve the instrument,
 * compute economics, ABI-encode + EIP-712 sign the trade with the session key,
 * and submit it to Derive's matching engine.
 */
import { config, type AccountCreds } from "./config";
import { canSign } from "./constants";
import {
  getTicker,
  placeOrder,
  type AuthCtx,
  type PlaceOrderBody,
  type Ticker,
} from "./client";
import {
  actionNonce,
  encodeTradeModuleData,
  MAX_INT_32,
  signAction,
} from "./signing";
import { computeEconomics, type Economics, type PresetId } from "./strategy";
import {
  recordFillOnArc,
  arcSettlementEnabled,
  type ArcSettlementResult,
} from "../arc/settlement";

export interface TradeRequest {
  preset: PresetId;
  instrumentName: string;
  amount: number;
  /** optional manual override of the limit price (else we compute a crossing price) */
  limitPrice?: number;
  /** connected (Privy) wallet the on-chain Arc settlement is booked to */
  trader?: string;
}

export interface TradeResult {
  economics: Economics;
  order: unknown;
  submitted: PlaceOrderBody;
  /** the maker's counter-order, when a liquidity account auto-fills the trade */
  makerOrder?: unknown;
  /** true when the maker counter-order produced an immediate fill */
  filled?: boolean;
  /** the on-chain Arc settlement of the matched fill (real, successful tx) */
  arcSettlement?: ArcSettlementResult | { error: string };
}

/**
 * Sign one limit order with a given account's session key and submit it.
 * Shared by the user-facing trade and the maker counter-order.
 */
async function signAndPlaceOrder(
  acct: AccountCreds,
  params: {
    ticker: Ticker;
    isBid: boolean;
    limitPrice: number | string;
    amount: number | string;
    maxFee: number | string;
    label: string;
    timeInForce?: PlaceOrderBody["time_in_force"];
  },
): Promise<{ order: unknown; body: PlaceOrderBody }> {
  const encoded = encodeTradeModuleData({
    assetAddress: params.ticker.base_asset_address as `0x${string}`,
    subId: BigInt(params.ticker.base_asset_sub_id),
    limitPrice: String(params.limitPrice),
    amount: String(params.amount),
    maxFee: String(params.maxFee),
    recipientId: acct.subaccountId,
    isBid: params.isBid,
  });
  const signed = await signAction({
    subaccountId: acct.subaccountId,
    owner: acct.owner,
    signerPrivateKey: acct.sessionPrivateKey,
    signatureExpirySec: MAX_INT_32,
    nonce: actionNonce(),
    moduleAddress: config.constants.tradeModuleAddress,
    encodedModuleData: encoded,
    domainSeparator: config.constants.domainSeparator,
    actionTypehash: config.constants.actionTypehash,
  });
  const body: PlaceOrderBody = {
    instrument_name: params.ticker.instrument_name,
    direction: params.isBid ? "buy" : "sell",
    order_type: "limit",
    time_in_force: params.timeInForce ?? "gtc",
    mmp: false,
    subaccount_id: acct.subaccountId,
    nonce: Number(signed.nonce),
    signer: signed.signer,
    signature_expiry_sec: signed.signatureExpirySec,
    signature: signed.signature,
    limit_price: String(params.limitPrice),
    amount: String(params.amount),
    max_fee: String(params.maxFee),
    label: params.label,
  };
  const auth: AuthCtx = {
    walletAddress: acct.owner,
    sessionPrivateKey: acct.sessionPrivateKey,
  };
  const order = await placeOrder(body, auth);
  return { order, body };
}

export async function placeStrategyOrder(req: TradeRequest): Promise<TradeResult> {
  if (!config.tradingEnabled) {
    throw new Error(
      "Trading not configured: set DERIVE_OWNER_ADDRESS, DERIVE_SUBACCOUNT_ID and DERIVE_SESSION_PRIVATE_KEY in server/.env (see README → onboarding).",
    );
  }
  if (!canSign(config.constants)) {
    throw new Error(
      `DERIVE_ENV=${config.env}: mainnet signing constants are not filled in src/derive/constants.ts (domainSeparator, tradeModuleAddress). Copy them from the Protocol Constants table at docs.derive.xyz. Market reads work without them; only order signing needs them.`,
    );
  }

  const ticker = await getTicker(req.instrumentName);
  if (!ticker.option_details) {
    throw new Error(`${req.instrumentName} is not an option instrument`);
  }
  const nowSec = Date.now() / 1000;
  const econ = computeEconomics(req.preset, ticker, req.amount, nowSec);

  const limitPrice = req.limitPrice ?? econ.limitPrice;

  // 1. Submit the user-facing order first; it rests on the book at limitPrice.
  const { order, body } = await signAndPlaceOrder(
    {
      owner: config.owner,
      subaccountId: config.subaccountId,
      sessionPrivateKey: config.sessionPrivateKey,
    },
    {
      ticker,
      isBid: econ.isBid,
      limitPrice,
      amount: req.amount,
      maxFee: econ.maxFee,
      label: `xchain-${req.preset}`,
    },
  );

  // The user order may cross resting liquidity (e.g. the market-maker bot's
  // quotes) immediately — in which case its own response carries the trades.
  const userResp = order as { trades?: Array<{ trade_id?: string }> } | undefined;
  let filled = Array.isArray(userResp?.trades) && userResp.trades.length > 0;
  let tradeId: string | undefined = userResp?.trades?.[0]?.trade_id;

  // 2. If not already filled and a maker (liquidity) account is configured,
  //    cross the user's resting order with the OPPOSITE side as an IOC taker so
  //    it fills instantly. Best-effort: a maker failure must not fail the trade.
  let makerOrder: unknown;
  if (!filled && config.makerEnabled) {
    try {
      const res = await signAndPlaceOrder(config.maker, {
        ticker,
        isBid: !econ.isBid, // opposite side of the user
        limitPrice,
        amount: req.amount,
        maxFee: econ.maxFee,
        label: `iris-mm-${req.preset}`,
        timeInForce: "ioc",
      });
      makerOrder = res.order;
      const mo = res.order as
        | { trades?: Array<{ trade_id?: string }> }
        | undefined;
      if (Array.isArray(mo?.trades) && mo.trades.length > 0) {
        filled = true;
        tradeId = mo.trades[0]?.trade_id;
      }
    } catch (e) {
      makerOrder = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // 3. Book the matched fill on-chain on Arc — a settlement tx that SUCCEEDS
  //    (unlike Derive's testnet settlement). Best-effort: never fails the trade.
  let arcSettlement: TradeResult["arcSettlement"];
  if (filled && arcSettlementEnabled) {
    const trader = (req.trader && /^0x[0-9a-fA-F]{40}$/.test(req.trader)
      ? req.trader
      : config.owner) as `0x${string}`;
    try {
      arcSettlement = await recordFillOnArc({
        trader,
        preset: req.preset,
        instrument: req.instrumentName,
        deriveTradeId: tradeId ?? `${req.instrumentName}-${econ.expiry}`,
        strike: econ.strike,
        size: req.amount,
        premiumPerUnit: econ.premium,
        premiumTotal: econ.premiumTotal,
        expiry: econ.expiry,
      });
    } catch (e) {
      arcSettlement = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return { economics: econ, order, submitted: body, makerOrder, filled, arcSettlement };
}
