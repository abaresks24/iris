import { NextResponse } from "next/server";
import { placeStrategyOrder } from "@/lib/derive/trade";
import type { PresetId } from "@/lib/derive/strategy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = new Set(["cash_secured_put", "covered_call", "long_call"]);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const preset = body?.preset as PresetId;
    const instrumentName = body?.instrumentName as string;
    const amount = Number(body?.amount);
    if (!VALID.has(preset) || !instrumentName || !(amount > 0)) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    const result = await placeStrategyOrder({
      preset,
      instrumentName,
      amount,
      limitPrice: body?.limitPrice ? Number(body.limitPrice) : undefined,
      trader: typeof body?.trader === "string" ? body.trader : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
