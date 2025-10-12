import { NextResponse } from "next/server";
import { getBestHeight } from "@/lib/blockbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  console.log('[HEIGHT] Querying blockchain height via Blockbook...');
  try {
    const height = await getBestHeight();
    console.log('[HEIGHT] ✓ Current height:', height);
    return NextResponse.json({ height });
  } catch (e: any) {
    console.error('[HEIGHT] ✗ Error:', e?.message ?? String(e));
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

