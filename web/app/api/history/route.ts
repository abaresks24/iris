import { NextResponse } from "next/server";
import { config } from "@/lib/derive/config";
import { getTradeHistory } from "@/lib/derive/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!config.tradingEnabled) return NextResponse.json({ tradingEnabled: false, trades: [] });
    const history = await getTradeHistory(config.subaccountId);
    return NextResponse.json({ tradingEnabled: true, ...history });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
