import { NextResponse } from "next/server";
import { getInstruments } from "@/lib/derive/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const currency = (new URL(req.url).searchParams.get("currency") || "ETH").toUpperCase();
    const instruments = await getInstruments({ currency, instrument_type: "option" });
    return NextResponse.json({ currency, count: instruments.length, instruments });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
