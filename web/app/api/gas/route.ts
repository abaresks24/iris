import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, ARC_RPC } from "@/lib/arc/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Arc pays gas in native USDC (6 decimals). A fresh wallet has none and can't
// sign anything, so the protocol drips a little gas to connected users.
const KEY = (process.env.ARC_SETTLEMENT_PRIVATE_KEY || "") as Hex;
// Arc native gas token is 18-decimal wei. Drip 0.3 "USDC" of gas; top up only
// if the wallet is below 0.1 (enough for the mint+approve+open txs).
const TOP_UP = 300_000_000_000_000_000n; // 0.3
const THRESHOLD = 100_000_000_000_000_000n; // 0.1

export async function POST(req: Request) {
  try {
    if (!KEY) return NextResponse.json({ error: "gas faucet not configured" }, { status: 400 });
    const { to } = await req.json();
    if (!to || !/^0x[0-9a-fA-F]{40}$/.test(to)) {
      return NextResponse.json({ error: "valid `to` address required" }, { status: 400 });
    }
    const pub = createPublicClient({ chain: arcTestnet, transport: http(ARC_RPC) });
    const bal = await pub.getBalance({ address: to as `0x${string}` });
    if (bal >= THRESHOLD) {
      return NextResponse.json({ funded: false, reason: "already has gas", balance: bal.toString() });
    }
    const account = privateKeyToAccount(KEY);
    const wallet = createWalletClient({ account, chain: arcTestnet, transport: http(ARC_RPC) });
    const hash = await wallet.sendTransaction({ to: to as `0x${string}`, value: TOP_UP });
    await pub.waitForTransactionReceipt({ hash, timeout: 30_000 });
    return NextResponse.json({ funded: true, txHash: hash, amount: TOP_UP.toString() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
