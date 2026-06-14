/**
 * Headless E2E test of the HERO Cash-Secured Put — the Arc OptionVault flow.
 * Mirrors components/DepositModal.tsx exactly, but from a throwaway wallet:
 *   /api/gas (drip gas) → quoteCashSecuredPut → mint USDC → approve → openCashSecuredPut
 * No real user funds: fresh key, faucet gas, mintable test USDC.
 *
 * Run from web/:  API=http://localhost:3000 node test-csp-vault.mjs
 */
import {
  createPublicClient, createWalletClient, http, defineChain, formatUnits,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const API = process.env.API || "http://localhost:3000";
const ARC_RPC = "https://rpc.testnet.arc.network";
const VAULT = "0x0cD8f966B5c1627B520cf28dC3a9c07Ee427497E";
const USDC = "0xE392aA90f0203c8717D1F15eDb591A382B05028f";
const MARKET_ID = { ETH: 0, BTC: 1, SOL: 2 };

const arc = defineChain({
  id: 5042002, name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC] } },
});

const USDC_ABI = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
];
const VAULT_ABI = [
  { type: "function", name: "quoteCashSecuredPut", stateMutability: "view", inputs: [{ name: "marketId", type: "uint8" }, { name: "strike", type: "uint256" }, { name: "size", type: "uint256" }, { name: "expiry", type: "uint64" }], outputs: [{ name: "collateral", type: "uint256" }, { name: "premium", type: "uint256" }] },
  { type: "function", name: "openCashSecuredPut", stateMutability: "nonpayable", inputs: [{ name: "marketId", type: "uint8" }, { name: "strike", type: "uint256" }, { name: "size", type: "uint256" }, { name: "expiry", type: "uint64" }], outputs: [{ name: "id", type: "uint256" }] },
  { type: "function", name: "positionsLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "positions", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [
    { name: "writer", type: "address" }, { name: "kind", type: "uint8" }, { name: "marketId", type: "uint8" }, { name: "strike", type: "uint256" }, { name: "size", type: "uint256" }, { name: "collateral", type: "uint256" }, { name: "premium", type: "uint256" }, { name: "openedAt", type: "uint64" }, { name: "expiry", type: "uint64" }, { name: "settled", type: "bool" },
  ] },
];

const toFeed8 = (n) => BigInt(Math.round(n * 1e8));
const toSize18 = (n) => BigInt(Math.round(n * 1e18));
const ok = (m) => console.log(`✅ ${m}`);
const step = (m) => console.log(`\n▶ ${m}`);

async function main() {
  const CURRENCY = "ETH";
  const AMOUNT = 1;

  step(`Fetch a real CSP candidate from Derive (${API}/api/strategies)`);
  const strat = await (await fetch(`${API}/api/strategies/cash_secured_put?currency=${CURRENCY}&amount=${AMOUNT}`)).json();
  const sel = strat.candidates?.[0];
  if (!sel) throw new Error("no candidate from /api/strategies");
  console.log(`   strike=$${sel.strike}  expiry=${sel.expiry}  premium≈$${sel.premium}  APR≈${sel.aprPct}%`);

  const marketId = MARKET_ID[CURRENCY];
  const strike = toFeed8(sel.strike);
  const size = toSize18(AMOUNT);
  const expiry = BigInt(Math.floor(sel.expiry));

  step("Generate a throwaway wallet");
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  console.log(`   wallet ${account.address}`);

  const pub = createPublicClient({ chain: arc, transport: http(ARC_RPC) });
  const wallet = createWalletClient({ account, chain: arc, transport: http(ARC_RPC) });

  step("Drip Arc gas via /api/gas");
  const gas = await (await fetch(`${API}/api/gas`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: account.address }) })).json();
  console.log("  ", gas);
  if (gas.error) throw new Error("gas faucet: " + gas.error);
  const bal = await pub.getBalance({ address: account.address });
  ok(`gas balance: ${formatUnits(bal, 18)} (native)`);
  if (bal === 0n) throw new Error("wallet still has no gas — cannot proceed");

  step("quoteCashSecuredPut → required collateral + premium");
  const [collateralWei, premiumWei] = await pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "quoteCashSecuredPut", args: [marketId, strike, size, expiry] });
  console.log(`   collateral=${formatUnits(collateralWei, 6)} USDC  premium=${formatUnits(premiumWei, 6)} USDC`);

  step("Mint test USDC (collateral)");
  let h = await wallet.writeContract({ address: USDC, abi: USDC_ABI, functionName: "mint", args: [account.address, collateralWei] });
  await pub.waitForTransactionReceipt({ hash: h });
  ok(`mint tx ${h}`);

  step("Approve the vault");
  h = await wallet.writeContract({ address: USDC, abi: USDC_ABI, functionName: "approve", args: [VAULT, collateralWei] });
  await pub.waitForTransactionReceipt({ hash: h });
  ok(`approve tx ${h}`);

  step("openCashSecuredPut — lock collateral, receive premium ON-CHAIN");
  const beforeLen = await pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "positionsLength" });
  h = await wallet.writeContract({ address: VAULT, abi: VAULT_ABI, functionName: "openCashSecuredPut", args: [marketId, strike, size, expiry] });
  const rcpt = await pub.waitForTransactionReceipt({ hash: h });
  ok(`open tx ${h}  (status ${rcpt.status}, block ${rcpt.blockNumber})`);
  console.log(`   explorer: https://testnet.arcscan.app/tx/${h}`);

  step("Verify the position landed on-chain");
  const afterLen = await pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "positionsLength" });
  console.log(`   positionsLength ${beforeLen} → ${afterLen}`);
  const pos = await pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "positions", args: [afterLen - 1n] });
  console.log(`   position.writer=${pos[0]}  strike=${formatUnits(pos[3],8)}  collateral=${formatUnits(pos[5],6)}  premium=${formatUnits(pos[6],6)}  settled=${pos[9]}`);
  const mine = pos[0].toLowerCase() === account.address.toLowerCase();

  step("Verify via /api/positions (what the dashboard reads)");
  const apiPos = await (await fetch(`${API}/api/positions?trader=${account.address}`)).json();
  console.log("  ", JSON.stringify(apiPos).slice(0, 300));

  console.log("\n" + (rcpt.status === "success" && mine ? "🎉 HERO CSP VAULT FLOW WORKS END-TO-END" : "⚠️ completed but verify the position fields above"));
}
main().catch((e) => { console.error("\n❌ FAILED:", e.shortMessage || e.message || e); process.exit(1); });
