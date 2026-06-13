/**
 * The end-to-end "place a strategy order" service: resolve the instrument,
 * compute economics, ABI-encode + EIP-712 sign the trade with the session key,
 * and submit it to Derive's matching engine.
 */
import { config } from "../config.js";
import { canSign } from "./constants.js";
import { getTicker, placeOrder, type PlaceOrderBody } from "./client.js";
import {
  actionNonce,
  encodeTradeModuleData,
  MAX_INT_32,
  signAction,
} from "./signing.js";
import { computeEconomics, type Economics, type PresetId } from "./strategy.js";

export interface TradeRequest {
  preset: PresetId;
  instrumentName: string;
  amount: number;
  /** optional manual override of the limit price (else we compute a crossing price) */
  limitPrice?: number;
}

export interface TradeResult {
  economics: Economics;
  order: unknown;
  submitted: PlaceOrderBody;
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
  const direction = econ.isBid ? "buy" : "sell";

  // 1. ABI-encode the trade module data.
  const encoded = encodeTradeModuleData({
    assetAddress: ticker.base_asset_address as `0x${string}`,
    subId: BigInt(ticker.base_asset_sub_id),
    limitPrice: String(limitPrice),
    amount: String(req.amount),
    maxFee: String(econ.maxFee),
    recipientId: config.subaccountId,
    isBid: econ.isBid,
  });

  // 2. Sign the action with the session key.
  const signed = await signAction({
    subaccountId: config.subaccountId,
    owner: config.owner,
    signerPrivateKey: config.sessionPrivateKey,
    signatureExpirySec: MAX_INT_32,
    nonce: actionNonce(),
    moduleAddress: config.constants.tradeModuleAddress,
    encodedModuleData: encoded,
    domainSeparator: config.constants.domainSeparator,
    actionTypehash: config.constants.actionTypehash,
  });

  // 3. Build the order body and submit.
  const body: PlaceOrderBody = {
    instrument_name: req.instrumentName,
    direction,
    order_type: "limit",
    time_in_force: "gtc",
    mmp: false,
    subaccount_id: config.subaccountId,
    nonce: signed.nonce,
    signer: signed.signer,
    signature_expiry_sec: signed.signatureExpirySec,
    signature: signed.signature,
    limit_price: String(limitPrice),
    amount: String(req.amount),
    max_fee: String(econ.maxFee),
    label: `xchain-${req.preset}`,
  };

  const order = await placeOrder(body);
  return { economics: econ, order, submitted: body };
}
