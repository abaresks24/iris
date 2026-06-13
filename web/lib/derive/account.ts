/**
 * Client-side Derive calls — each user talks to Derive with THEIR OWN account
 * and device session key. Orders are signed in the browser; the shared backend
 * is never involved in custody.
 *
 * Note: this calls api-demo.lyra.finance directly from the browser. If CORS
 * blocks the signed POST, the fallback is a thin stateless relay on our backend
 * (forwards the already-signed payload — no key needed). Reads can stay on our
 * backend either way.
 */
import type { Address } from "viem";
import { DERIVE } from "./constants";
import {
  actionNonce,
  authHeaders,
  encodeTradeModuleData,
  MAX_INT_32,
  signAction,
} from "./sign";

async function post<T>(
  endpoint: string,
  body: unknown,
  auth?: { owner: Address; sessionPrivateKey: `0x${string}` },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (auth) Object.assign(headers, await authHeaders(auth.owner, auth.sessionPrivateKey));
  const res = await fetch(`${DERIVE.restUrl}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { result?: T; error?: unknown };
  if (json.error || !res.ok) throw new Error(JSON.stringify(json.error ?? json));
  return json.result as T;
}

/** All subaccount ids owned by a wallet (empty ⇒ user not onboarded yet). */
export async function getSubaccounts(
  owner: Address,
  sessionPrivateKey: `0x${string}`,
): Promise<number[]> {
  const r = await post<{ subaccount_ids: number[] }>(
    "/private/get_subaccounts",
    { wallet: owner },
    { owner, sessionPrivateKey },
  );
  return r.subaccount_ids ?? [];
}

interface TickerLite {
  base_asset_address: Address;
  base_asset_sub_id: string;
}

export async function getTicker(instrument_name: string): Promise<TickerLite> {
  return post<TickerLite>("/public/get_ticker", { instrument_name });
}

export interface ClientOrder {
  owner: Address;
  sessionPrivateKey: `0x${string}`;
  subaccountId: number;
  instrumentName: string;
  direction: "buy" | "sell";
  limitPrice: number;
  amount: number;
  maxFee: number;
}

/** Sign an order in the browser with the device session key and submit it. */
export async function placeOrder(o: ClientOrder): Promise<unknown> {
  const ticker = await getTicker(o.instrumentName);
  const isBid = o.direction === "buy";

  const encoded = encodeTradeModuleData({
    assetAddress: ticker.base_asset_address,
    subId: BigInt(ticker.base_asset_sub_id),
    limitPrice: String(o.limitPrice),
    amount: String(o.amount),
    maxFee: String(o.maxFee),
    recipientId: o.subaccountId,
    isBid,
  });

  const signed = await signAction({
    subaccountId: o.subaccountId,
    owner: o.owner,
    signerPrivateKey: o.sessionPrivateKey,
    signatureExpirySec: MAX_INT_32,
    nonce: actionNonce(),
    moduleAddress: DERIVE.tradeModuleAddress,
    encodedModuleData: encoded,
  });

  return post(
    "/private/order",
    {
      instrument_name: o.instrumentName,
      direction: o.direction,
      order_type: "limit",
      time_in_force: "gtc",
      mmp: false,
      subaccount_id: o.subaccountId,
      nonce: signed.nonce,
      signer: signed.signer,
      signature_expiry_sec: signed.signatureExpirySec,
      signature: signed.signature,
      limit_price: String(o.limitPrice),
      amount: String(o.amount),
      max_fee: String(o.maxFee),
      label: "iris-client",
    },
    { owner: o.owner, sessionPrivateKey: o.sessionPrivateKey },
  );
}
