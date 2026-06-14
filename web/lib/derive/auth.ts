/**
 * Derive authentication, ported from utils.py (sign_rest_auth_header /
 * sign_ws_login). Both sign the current UTC-ms timestamp as an EIP-191
 * personal_message with the session key; the smart-contract wallet address
 * travels alongside so the matching engine knows which account to bind to.
 */
import { privateKeyToAccount } from "viem/accounts";
import type { Address } from "viem";

export interface AuthParams {
  walletAddress: Address; // the smart-contract wallet (owner) address
  sessionPrivateKey: `0x${string}`;
}

export async function restAuthHeaders(
  p: AuthParams,
): Promise<Record<string, string>> {
  const account = privateKeyToAccount(p.sessionPrivateKey);
  const timestamp = Date.now().toString();
  const signature = await account.signMessage({ message: timestamp });
  return {
    "X-LyraWallet": p.walletAddress,
    "X-LyraTimestamp": timestamp,
    "X-LyraSignature": signature,
  };
}

export async function wsLoginParams(p: AuthParams) {
  const account = privateKeyToAccount(p.sessionPrivateKey);
  const timestamp = Date.now().toString();
  const signature = await account.signMessage({ message: timestamp });
  return {
    wallet: p.walletAddress,
    timestamp,
    signature,
  };
}
