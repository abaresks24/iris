/**
 * Verify the Derive trading setup end-to-end (read-only signing check) and
 * auto-discover the subaccount id.
 *
 *   npm run onboard:check --prefix server
 *
 * Prereqs (one-time, via testnet.derive.xyz):
 *   - an account + funded subaccount
 *   - the session key ADDRESS registered (Developers page)
 *   - server/.env: DERIVE_OWNER_ADDRESS + DERIVE_SESSION_PRIVATE_KEY
 *
 * If the session key is registered and the account exists, this prints the
 * subaccount id(s) to drop into DERIVE_SUBACCOUNT_ID — then trading is live.
 */
import { config, ZERO_ADDR, ZERO_KEY } from "../config.js";
import { getSubaccounts, getSubaccount } from "../derive/client.js";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  console.log("\n  Derive onboarding check\n  ─────────────────────────");
  console.log(`  env:      ${config.env} (${config.constants.restUrl})`);

  if (config.owner.toLowerCase() === ZERO_ADDR) {
    console.log("\n  ✗ DERIVE_OWNER_ADDRESS not set in server/.env");
    console.log("    → set it to the wallet you onboarded on testnet.derive.xyz\n");
    return;
  }
  if (config.sessionPrivateKey === ZERO_KEY) {
    console.log("\n  ✗ DERIVE_SESSION_PRIVATE_KEY not set in server/.env");
    console.log("    → run `npm run signkey`, register the ADDRESS on Derive, put the KEY here\n");
    return;
  }

  const sessionAddr = privateKeyToAccount(config.sessionPrivateKey).address;
  console.log(`  owner:    ${config.owner}`);
  console.log(`  session:  ${sessionAddr} (must be registered on Derive)`);

  try {
    const res = await getSubaccounts();
    const ids: number[] = res?.subaccount_ids ?? [];
    if (!ids.length) {
      console.log("\n  ⚠️ Auth OK but no subaccounts found.");
      console.log("    → create/fund a subaccount on testnet.derive.xyz, then re-run.\n");
      return;
    }
    console.log(`\n  ✓ Session key authenticated. Subaccounts: ${ids.join(", ")}`);
    for (const id of ids) {
      try {
        const sa = await getSubaccount(id);
        const cols = (sa?.collaterals ?? [])
          .map((c: any) => `${c.amount} ${c.asset_name}`)
          .join(", ");
        console.log(`    • subaccount ${id} — collateral: ${cols || "none"} · positions: ${(sa?.positions ?? []).length}`);
      } catch {
        console.log(`    • subaccount ${id}`);
      }
    }
    console.log(`\n  → set DERIVE_SUBACCOUNT_ID=${ids[0]} in server/.env, restart, and trading is live.\n`);
  } catch (e) {
    console.log(`\n  ✗ Auth failed: ${e instanceof Error ? e.message : String(e)}`);
    console.log("    Likely the session key isn't registered yet (wait ~1 min after the on-chain tx),");
    console.log("    or the owner address doesn't match the onboarded account.\n");
  }
}

main();
