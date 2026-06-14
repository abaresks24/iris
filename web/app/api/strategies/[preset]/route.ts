import { NextResponse } from "next/server";
import { listStrategyCandidates } from "@/lib/derive/market";
import type { PresetId } from "@/lib/derive/strategy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = new Set(["cash_secured_put", "covered_call", "long_call"]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ preset: string }> },
) {
  try {
    const { preset } = await params;
    if (!VALID.has(preset)) {
      return NextResponse.json({ error: `unknown preset ${preset}` }, { status: 400 });
    }
    const url = new URL(req.url);
    const currency = (url.searchParams.get("currency") || "ETH").toUpperCase();
    const amount = Number(url.searchParams.get("amount") ?? 1) || 1;
    const result = await listStrategyCandidates(preset as PresetId, currency, amount);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
