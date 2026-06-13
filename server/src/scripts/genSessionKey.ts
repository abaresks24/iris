/**
 * Generate a fresh throwaway EVM keypair to use as a Derive session key.
 *
 *   npm run signkey
 *
 * Then register the printed ADDRESS as a session key on your Derive account
 * (Derive app → Settings → Developers/Session Keys), and put the PRIVATE KEY
 * in server/.env as DERIVE_SESSION_PRIVATE_KEY. Session keys can sign orders
 * but cannot withdraw to arbitrary addresses, so this key is safe to hold here.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const pk = generatePrivateKey();
const account = privateKeyToAccount(pk);

console.log("\n  New Derive session keypair (throwaway — no real funds):\n");
console.log(`  ADDRESS      ${account.address}`);
console.log(`  PRIVATE KEY  ${pk}\n`);
console.log("  → Register the ADDRESS as a session key in the Derive app.");
console.log("  → Put the PRIVATE KEY in server/.env as DERIVE_SESSION_PRIVATE_KEY.\n");
