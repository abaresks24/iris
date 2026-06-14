import { NextResponse } from "next/server";
import { getTicker } from "@/lib/derive/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ instrument: string }> },
) {
  try {
    const { instrument } = await params;
    return NextResponse.json(await getTicker(instrument));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
