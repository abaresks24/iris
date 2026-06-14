/**
 * Cross-chain USDC funding into Arc via Circle CCTP V2.
 *   source chain: approve TokenMessenger → depositForBurn(destDomain = Arc 26)
 *   → poll Circle attestation → receiveMessage on Arc (mints native USDC).
 *
 * This is the "deposit from any chain → Arc liquidity hub" funnel (Circle track),
 * and the action a LI.FI Composer Flow would orchestrate on the source side
 * (swap any token → USDC → depositForBurn) as a single Flow.
 *
 * ⚠️ Not verified on-chain here (needs source-chain USDC + the attestation
 * round-trip). Addresses below are CCTP V2; confirm per source chain before prod.
 */
import {
  encodeAbiParameters,
  pad,
  parseUnits,
  type Address,
  type WalletClient,
} from "viem";
import { ADDR, CCTP } from "./arc";

/** CCTP V2 testnet source chains (domain + Circle USDC). TokenMessengerV2 is
 *  deployed at the same address across V2 chains. */
export const CCTP_SOURCES: Record<
  number,
  { name: string; domain: number; usdc: Address; tokenMessenger: Address }
> = {
  11155111: { name: "Ethereum Sepolia", domain: 0, usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", tokenMessenger: CCTP.tokenMessengerV2 as Address },
  84532: { name: "Base Sepolia", domain: 6, usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", tokenMessenger: CCTP.tokenMessengerV2 as Address },
  421614: { name: "Arbitrum Sepolia", domain: 3, usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", tokenMessenger: CCTP.tokenMessengerV2 as Address },
};

const ARC_DOMAIN = CCTP.arcDomain; // 26

const tokenMessengerAbi = [
  {
    type: "function",
    name: "depositForBurn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [],
  },
] as const;

const messageTransmitterAbi = [
  {
    type: "function",
    name: "receiveMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const erc20ApproveAbi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const ATTESTATION_API = "https://iris-api-sandbox.circle.com/v2/messages";

/** Step 1 — burn USDC on the source chain, targeting Arc. Returns the tx hash. */
export async function burnToArc(
  wallet: WalletClient,
  account: Address,
  sourceChainId: number,
  amountUsdc: string,
): Promise<`0x${string}`> {
  const src = CCTP_SOURCES[sourceChainId];
  if (!src) throw new Error(`CCTP not configured for chain ${sourceChainId}`);
  const amount = parseUnits(amountUsdc, 6);
  const mintRecipient = pad(account, { size: 32 });

  await wallet.writeContract({
    address: src.usdc,
    abi: erc20ApproveAbi,
    functionName: "approve",
    args: [src.tokenMessenger, amount],
    account,
    chain: null,
  });

  return wallet.writeContract({
    address: src.tokenMessenger,
    abi: tokenMessengerAbi,
    functionName: "depositForBurn",
    args: [
      amount,
      ARC_DOMAIN,
      mintRecipient,
      src.usdc,
      pad("0x", { size: 32 }), // anyone can finalise
      0n, // maxFee (standard transfer)
      2000, // minFinalityThreshold (standard)
    ],
    account,
    chain: null,
  });
}

/** Step 2 — poll Circle for the attestation of a burn tx. */
export async function getAttestation(
  sourceChainId: number,
  burnTxHash: string,
): Promise<{ message: `0x${string}`; attestation: `0x${string}` } | null> {
  const src = CCTP_SOURCES[sourceChainId];
  const res = await fetch(`${ATTESTATION_API}/${src.domain}?transactionHash=${burnTxHash}`);
  if (!res.ok) return null;
  const data = await res.json();
  const m = data?.messages?.[0];
  if (!m || m.status !== "complete") return null;
  return { message: m.message, attestation: m.attestation };
}

/** Step 3 — mint the USDC on Arc with the attestation. Returns the tx hash. */
export async function mintOnArc(
  wallet: WalletClient,
  account: Address,
  message: `0x${string}`,
  attestation: `0x${string}`,
): Promise<`0x${string}`> {
  return wallet.writeContract({
    address: CCTP.messageTransmitterV2 as Address,
    abi: messageTransmitterAbi,
    functionName: "receiveMessage",
    args: [message, attestation],
    account,
    chain: null,
  });
}

// keep encodeAbiParameters referenced for potential hook-payload composition
void encodeAbiParameters;
void ADDR;
