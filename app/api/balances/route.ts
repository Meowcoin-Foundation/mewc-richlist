import { NextResponse } from "next/server";
import { getBalancesBatch } from "@/lib/blockbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { addresses } = await req.json() as { addresses: string[] };
    console.log('[BALANCES] Received request for', addresses?.length, 'addresses');
    
    if (!Array.isArray(addresses) || addresses.length === 0) {
      console.error('[BALANCES] Invalid addresses array');
      return NextResponse.json({ error: "addresses[]" }, { status: 400 });
    }

    console.log('[BALANCES] Querying Blockbook for balances...');
    const results = await getBalancesBatch(addresses, 8);

    const totalBalance = results.reduce((sum, r) => sum + r.balanceSat, 0);
    console.log('[BALANCES] ✓ Total balance:', totalBalance / 1e8, 'MEWC');
    
    return NextResponse.json({ results });
  } catch (e: any) {
    console.error('[BALANCES] ✗ Error:', e?.message ?? String(e));
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

