import { NextResponse } from "next/server";
import { PRESETS } from "@/lib/derive/strategy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ presets: Object.values(PRESETS) });
}
