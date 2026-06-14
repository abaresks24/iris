import { NextResponse } from "next/server";
import { getArcPositions } from "@/lib/arc/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const trader = new URL(req.url).searchParams.get("trader");
    if (!trader || !/^0x[0-9a-fA-F]{40}$/.test(trader)) {
      return NextResponse.json({ error: "valid ?trader= address required" }, { status: 400 });
    }
    const data = await getArcPositions(trader);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
