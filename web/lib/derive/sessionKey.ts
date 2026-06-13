/**
 * Per-device session key — generated and kept in the browser (localStorage),
 * exactly like Derive's own "device session keys". Each user signs their own
 * orders with this key; it's registered to THEIR Derive account.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const STORAGE_KEY = "iris.deviceSessionKey.v1";

export interface DeviceSessionKey {
  privateKey: `0x${string}`;
  address: `0x${string}`;
}

export function getOrCreateSessionKey(): DeviceSessionKey {
  if (typeof window === "undefined") {
    throw new Error("Session key is browser-only");
  }
  let pk = window.localStorage.getItem(STORAGE_KEY) as `0x${string}` | null;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    pk = generatePrivateKey();
    window.localStorage.setItem(STORAGE_KEY, pk);
  }
  return { privateKey: pk, address: privateKeyToAccount(pk).address };
}

export function peekSessionKey(): DeviceSessionKey | null {
  if (typeof window === "undefined") return null;
  const pk = window.localStorage.getItem(STORAGE_KEY) as `0x${string}` | null;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) return null;
  return { privateKey: pk, address: privateKeyToAccount(pk).address };
}

export function clearSessionKey() {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}
