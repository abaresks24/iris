/**
 * EIP-712 action signing for Derive, ported 1:1 from the official SDK
 * (derivexyz/v2-action-signing-python → signed_action.py, module_data/trade.py).
 *
 * The flow for any signed action (a trade is the only one we need for the MVP):
 *   1. ABI-encode the module-specific data        (encodeTradeModuleData)
 *   2. keccak the module data                       → moduleDataHash
 *   3. ABI-encode the action envelope               (typehash, ids, nonce, ...)
 *   4. keccak the envelope                           → actionHash
 *   5. typedDataHash = keccak(0x1901 ‖ DOMAIN_SEPARATOR ‖ actionHash)
 *   6. raw-sign typedDataHash with the session key  → 65-byte signature
 */
import {
  concat,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  type Address,
} from "viem";
import { privateKeyToAccount, sign, serializeSignature } from "viem/accounts";

/** Scale a human decimal string to a 1e18 fixed-point bigint (signed-safe). */
export function toBigInt18(value: string | number): bigint {
  const s = typeof value === "number" ? value.toString() : value.trim();
  const neg = s.startsWith("-");
  const [intPart, fracPartRaw = ""] = (neg ? s.slice(1) : s).split(".");
  const frac = (fracPartRaw + "0".repeat(18)).slice(0, 18);
  const magnitude = BigInt((intPart || "0") + frac);
  return neg ? -magnitude : magnitude;
}

/** Nonce = <UTC ms><3-digit random>, matching get_action_nonce() in the SDK. */
export function actionNonce(): bigint {
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return BigInt(`${Date.now()}${rand}`);
}

export const MAX_INT_32 = 2 ** 31 - 1;

export interface TradeModuleData {
  assetAddress: Address;
  subId: bigint;
  limitPrice: string; // human decimal, e.g. "100.5"
  amount: string; // human decimal
  maxFee: string; // human decimal (USDC)
  recipientId: number;
  isBid: boolean;
}

/** Step 1: ABI-encode the trade module data (trade.py → to_abi_encoded). */
export function encodeTradeModuleData(d: TradeModuleData): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters("address, uint256, int256, int256, uint256, uint256, bool"),
    [
      d.assetAddress,
      d.subId,
      toBigInt18(d.limitPrice),
      toBigInt18(d.amount),
      toBigInt18(d.maxFee),
      BigInt(d.recipientId),
      d.isBid,
    ],
  );
}

export interface SignActionParams {
  subaccountId: number;
  owner: Address;
  signerPrivateKey: `0x${string}`;
  signatureExpirySec: number;
  nonce: bigint;
  moduleAddress: Address;
  encodedModuleData: `0x${string}`;
  domainSeparator: `0x${string}`;
  actionTypehash: `0x${string}`;
}

export interface SignedActionResult {
  signer: Address;
  signature: `0x${string}`;
  nonce: string;
  signatureExpirySec: number;
  typedDataHash: `0x${string}`;
}

/** Steps 2-6: build the action hash, the typed-data hash, and sign it. */
export async function signAction(
  p: SignActionParams,
): Promise<SignedActionResult> {
  const account = privateKeyToAccount(p.signerPrivateKey);

  const moduleDataHash = keccak256(p.encodedModuleData);

  const actionHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32, uint256, uint256, address, bytes32, uint256, address, address",
      ),
      [
        p.actionTypehash,
        BigInt(p.subaccountId),
        p.nonce,
        p.moduleAddress,
        moduleDataHash,
        BigInt(p.signatureExpirySec),
        p.owner,
        account.address,
      ],
    ),
  );

  // typedDataHash = keccak256("0x1901" ‖ DOMAIN_SEPARATOR ‖ actionHash)
  const typedDataHash = keccak256(
    concat(["0x1901", p.domainSeparator, actionHash]),
  );

  // Raw ECDSA over the 32-byte digest (== eth_account unsafe_sign_hash).
  const sig = await sign({ hash: typedDataHash, privateKey: p.signerPrivateKey });
  const signature = serializeSignature(sig);

  return {
    signer: account.address,
    signature,
    nonce: p.nonce.toString(),
    signatureExpirySec: p.signatureExpirySec,
    typedDataHash,
  };
}
