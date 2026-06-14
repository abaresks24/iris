import { NextResponse } from "next/server";
import { config } from "@/lib/derive/config";
import { getSubaccount, getOpenOrders } from "@/lib/derive/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!config.tradingEnabled) return NextResponse.json({ tradingEnabled: false });
    const [subaccount, openOrders] = await Promise.all([
      getSubaccount(config.subaccountId),
      getOpenOrders(config.subaccountId).catch(() => null),
    ]);
    return NextResponse.json({ tradingEnabled: true, subaccount, openOrders });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
