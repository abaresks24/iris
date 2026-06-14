/**
 * Live orderbook simulator for the Iris demo.
 *
 * Posts resting BID quotes on near-the-money ETH/BTC puts & calls from the
 * maker account, and re-posts them with fresh jitter every few seconds. Since
 * the strategy economics price the premium off the live best bid/ask, this
 * makes the displayed APRs move in real time — a believable live orderbook.
 *
 * Bids only (no shorts) → no margin headaches; the bot just pays premium if a
 * user order ever crosses it (which is a real, welcome fill). Runs locally:
 *
 *   node --env-file=web/.env.local web/scripts/marketBot.mjs
 *
 * Stop with Ctrl-C (it cancels all its quotes on exit).
 */
import { privateKeyToAccount, sign, serializeSignature } from "viem/accounts";
import { encodeAbiParameters, parseAbiParameters, keccak256, concat } from "viem";

// ── Derive demo (testnet, chain 901) constants ──────────────────────────
const REST = "https://api-demo.lyra.finance";
const DOMAIN_SEPARATOR = "0x9bcf4dc06df5d8bf23af818d5716491b995020f377d3b7b64c29ed14e3dd1105";
const ACTION_TYPEHASH = "0x4d7a9f27c403ff9c0f19bce61d76d82f9aa29f8d6d4b0c5474607d9770d1af17";
const TRADE_MODULE = "0x87F2863866D85E3192a35A73b388BD625D83f2be";

const OWNER = process.env.MAKER_OWNER_ADDRESS;
const SUB = Number(process.env.MAKER_SUBACCOUNT_ID);
const KEY = process.env.MAKER_SESSION_PRIVATE_KEY;
if (!OWNER || !SUB || !KEY) {
  console.error("Missing MAKER_OWNER_ADDRESS / MAKER_SUBACCOUNT_ID / MAKER_SESSION_PRIVATE_KEY (run with --env-file=web/.env.local)");
  process.exit(1);
}
const account = privateKeyToAccount(KEY);

// ── tiny helpers ─────────────────────────────────────────────────────────
const num = (s) => { const n = Number(s ?? "0"); return Number.isFinite(n) ? n : 0; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function toBigInt18(value) {
  const s = String(value); const neg = s.startsWith("-");
  const [i, f = ""] = (neg ? s.slice(1) : s).split(".");
  const frac = (f + "0".repeat(18)).slice(0, 18);
  const mag = BigInt((i || "0") + frac);
  return neg ? -mag : mag;
}
const actionNonce = () => BigInt(`${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`);
const MAX_INT_32 = 2 ** 31 - 1;

async function authHeaders() {
  const ts = Date.now().toString();
  const signature = await account.signMessage({ message: ts });
  return { "X-LyraWallet": OWNER, "X-LyraTimestamp": ts, "X-LyraSignature": signature };
}
async function rpc(endpoint, body, auth = false) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (auth) Object.assign(headers, await authHeaders());
  const res = await fetch(`${REST}${endpoint}`, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json();
  if (json.error) throw new Error(`${endpoint}: ${JSON.stringify(json.error)}`);
  return json.result;
}

function encodeTradeModuleData(d) {
  return encodeAbiParameters(
    parseAbiParameters("address, uint256, int256, int256, uint256, uint256, bool"),
    [d.assetAddress, d.subId, toBigInt18(d.limitPrice), toBigInt18(d.amount), toBigInt18(d.maxFee), BigInt(d.recipientId), d.isBid],
  );
}
async function signAction(encoded, nonce) {
  const moduleDataHash = keccak256(encoded);
  const actionHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters("bytes32, uint256, uint256, address, bytes32, uint256, address, address"),
      [ACTION_TYPEHASH, BigInt(SUB), nonce, TRADE_MODULE, moduleDataHash, BigInt(MAX_INT_32), OWNER, account.address],
    ),
  );
  const typedDataHash = keccak256(concat(["0x1901", DOMAIN_SEPARATOR, actionHash]));
  const sig = await sign({ hash: typedDataHash, privateKey: KEY });
  return { signature: serializeSignature(sig), signer: account.address, nonce: Number(nonce) };
}

const tickDecimals = (tick) => { const i = String(tick).indexOf("."); return i < 0 ? 0 : String(tick).length - i - 1; };
// Round to the instrument's tick and format to its exact decimals (Derive
// rejects extra decimals / float artifacts like 143.20000000000002).
function fmtTick(price, t) {
  const tick = t.tick > 0 ? t.tick : 0.1;
  let p = Math.max(tick, Math.round(price / tick) * tick);
  p = Math.min(Math.max(p, t.min || tick), t.max || p);
  return p.toFixed(tickDecimals(tick));
}

async function placeBid(t, price) {
  const limit = fmtTick(price, t);
  const nonce = actionNonce();
  const encoded = encodeTradeModuleData({
    assetAddress: t.assetAddress, subId: BigInt(t.subId),
    limitPrice: limit, amount: String(t.amount), maxFee: "100",
    recipientId: SUB, isBid: true,
  });
  const signed = await signAction(encoded, nonce);
  await rpc("/private/order", {
    instrument_name: t.instrument_name, direction: "buy", order_type: "limit",
    time_in_force: "gtc", mmp: false, subaccount_id: SUB,
    nonce: signed.nonce, signer: signed.signer, signature_expiry_sec: MAX_INT_32,
    signature: signed.signature, limit_price: limit, amount: String(t.amount),
    max_fee: "100", label: "iris-mm-sim",
  }, true);
}

// ── choose instruments: EXACTLY the ones the app displays ──────────────────
// Read the app's own /api/strategies so we quote the same (tradeable) strikes.
// Some listed expiries aren't active on the matching engine ("Instrument not
// found"); the app only surfaces tradeable ones, so mirroring it is robust.
const APP = process.env.IRIS_API || "https://iris-finance.vercel.app";
const PRESETS = ["cash_secured_put", "covered_call", "long_call"];

async function pickTargets() {
  // instrument metadata (asset address / subId / tick / size) by name
  const meta = {};
  for (const currency of ["ETH", "BTC"]) {
    const ins = await rpc("/public/get_instruments", { currency, instrument_type: "option", expired: false });
    for (const i of ins || []) meta[i.instrument_name] = i;
  }
  const targets = [];
  const seen = new Set();
  for (const currency of ["ETH", "BTC"]) {
    for (const preset of PRESETS) {
      const r = await fetch(`${APP}/api/strategies/${preset}?currency=${currency}&amount=1`).then((x) => x.json()).catch(() => null);
      for (const c of r?.candidates || []) {
        if (seen.has(c.instrumentName) || !meta[c.instrumentName]) continue;
        const m = meta[c.instrumentName];
        const tk = await rpc("/public/get_ticker", { instrument_name: c.instrumentName });
        const mark = num(tk.mark_price) || num(tk.option_pricing?.mark_price);
        if (!(mark > 0)) continue;
        seen.add(c.instrumentName);
        targets.push({
          instrument_name: c.instrumentName,
          assetAddress: m.base_asset_address, subId: m.base_asset_sub_id,
          tick: num(m.tick_size), min: num(tk.min_price), max: num(tk.max_price),
          amount: m.minimum_amount, baseMark: mark,
        });
      }
    }
  }
  return targets;
}

async function cancelAll() { try { await rpc("/private/cancel_all", { subaccount_id: SUB }, true); } catch {} }

let running = true;
process.on("SIGINT", async () => { running = false; console.log("\n↩ cancelling quotes…"); await cancelAll(); process.exit(0); });
process.on("SIGTERM", async () => { running = false; await cancelAll(); process.exit(0); });

(async () => {
  console.log("🤖 Iris market-maker sim — maker subaccount", SUB);
  let targets = await pickTargets();
  console.log(`   quoting ${targets.length} instruments:`, targets.map((t) => t.instrument_name).join(", "));
  let cycle = 0;
  while (running) {
    await cancelAll();
    // refresh marks occasionally so quotes track the real market
    if (cycle > 0 && cycle % 12 === 0) targets = await pickTargets();
    let ok = 0; let firstErr = null;
    for (const t of targets) {
      // bid below mark, jittered ±6% each cycle → best_bid (and thus APR) moves
      const jitter = 1 + (Math.random() * 0.12 - 0.06);
      const price = t.baseMark * 0.97 * jitter;
      try { await placeBid(t, price); ok++; } catch (e) { if (!firstErr) firstErr = e.message; }
      await sleep(220); // pace to stay under the matching rate limit
    }
    console.log(`cycle ${++cycle}: posted ${ok}/${targets.length} bids${firstErr ? " · err: " + firstErr.slice(0, 120) : ""}`);
    await sleep(2500);
  }
})();
