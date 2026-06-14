import { NextResponse } from "next/server";
import { config } from "@/lib/derive/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    env: config.env,
    restUrl: config.constants.restUrl,
    tradingEnabled: config.tradingEnabled,
    subaccountId: config.tradingEnabled ? config.subaccountId : null,
  });
}
