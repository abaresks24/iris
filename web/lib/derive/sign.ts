/**
 * Client-side EIP-712 action signing for Derive — a faithful port of the
 * verified server signer (server/src/derive/signing.ts), so each user signs
 * THEIR OWN orders in the browser with THEIR OWN device session key. No funds
 * ever route through a shared backend account.
 */
import {
  concat,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  type Address,
} from "viem";
import { privateKeyToAccount, sign, serializeSignature } from "viem/accounts";
import { DERIVE } from "./constants";

export const MAX_INT_32 = 2 ** 31 - 1;

export function toBigInt18(value: string | number): bigint {
  const s = typeof value === "number" ? value.toString() : value.trim();
  const neg = s.startsWith("-");
  const [intPart, fracRaw = ""] = (neg ? s.slice(1) : s).split(".");
  const frac = (fracRaw + "0".repeat(18)).slice(0, 18);
  const mag = BigInt((intPart || "0") + frac);
  return neg ? -mag : mag;
}

export function actionNonce(): bigint {
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return BigInt(`${Date.now()}${rand}`);
}

export interface TradeModuleData {
  assetAddress: Address;
  subId: bigint;
  limitPrice: string;
  amount: string;
  maxFee: string;
  recipientId: number;
  isBid: boolean;
}

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
}

export interface SignedActionResult {
  signer: Address;
  signature: `0x${string}`;
  nonce: string;
  signatureExpirySec: number;
  typedDataHash: `0x${string}`;
}

export async function signAction(p: SignActionParams): Promise<SignedActionResult> {
  const account = privateKeyToAccount(p.signerPrivateKey);
  const moduleDataHash = keccak256(p.encodedModuleData);

  const actionHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32, uint256, uint256, address, bytes32, uint256, address, address",
      ),
      [
        DERIVE.actionTypehash,
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

  const typedDataHash = keccak256(concat(["0x1901", DERIVE.domainSeparator, actionHash]));
  const sig = await sign({ hash: typedDataHash, privateKey: p.signerPrivateKey });

  return {
    signer: account.address,
    signature: serializeSignature(sig),
    nonce: p.nonce.toString(),
    signatureExpirySec: p.signatureExpirySec,
    typedDataHash,
  };
}

/** REST auth headers, signed by the session key (EIP-191 personal_sign of ms timestamp). */
export async function authHeaders(
  walletAddress: Address,
  sessionPrivateKey: `0x${string}`,
): Promise<Record<string, string>> {
  const account = privateKeyToAccount(sessionPrivateKey);
  const timestamp = Date.now().toString();
  const signature = await account.signMessage({ message: timestamp });
  return {
    "X-LyraWallet": walletAddress,
    "X-LyraTimestamp": timestamp,
    "X-LyraSignature": signature,
  };
}
