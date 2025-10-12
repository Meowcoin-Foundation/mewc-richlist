import { NextResponse } from "next/server";
import labels from "@/data/labels.json";
import { getBestHeight, getBalancesBatch } from "@/lib/blockbook";
import { getLastHeight, setLastHeight, getTopFile, setTopFile, mewcString } from "@/lib/store";
import { discoverNewAddresses } from "@/lib/block-scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for scanning

type LabelMap = Record<string, string>;

export async function GET() {
  const TOPN = Number(process.env.TOPN ?? 200);
  const MIN_BALANCE = Number(process.env.MIN_BALANCE || 1000000000); // 10 MEWC default
  const PROACTIVE_MODE = process.env.PROACTIVE_SCAN !== "false"; // Enabled by default
  
  console.log('[REFRESH] Starting refresh process...');
  console.log('[REFRESH] TOPN:', TOPN);
  console.log('[REFRESH] MIN_BALANCE:', MIN_BALANCE / 1e8, 'MEWC');
  console.log('[REFRESH] Proactive scan:', PROACTIVE_MODE);

  try {
    // Check Blob token
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    console.log('[REFRESH] Blob token exists:', !!blobToken);
    if (!blobToken) {
      throw new Error('BLOB_READ_WRITE_TOKEN not set in environment variables');
    }

    const last = await getLastHeight();
    console.log('[REFRESH] Last processed height:', last);
    console.log('[REFRESH] Request timestamp:', Date.now());
    
    let best: number;
    
    if (PROACTIVE_MODE && last !== null) {
      // Proactive mode: Try to fetch the next expected block
      // Meowcoin has ~1 minute blocks, so try last + 1
      const nextExpected = last + 1;
      console.log(`[REFRESH] 🚀 Proactive mode: Trying block ${nextExpected}...`);
      
      try {
        // Try to fetch the next block directly
        const blockbookBase = process.env.BLOCKBOOK_URL!;
        const url = `${blockbookBase}/api/v2/block/${nextExpected}?_cb=${Date.now()}`;
        const r = await fetch(url, { 
          cache: "no-store",
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        if (r.ok) {
          // Block exists! Use it
          best = nextExpected;
          console.log(`[REFRESH] ✓ Block ${best} found proactively!`);
        } else if (r.status === 404) {
          // Block doesn't exist yet
          console.log(`[REFRESH] Block ${nextExpected} not found yet, checking current height...`);
          best = await getBestHeight();
          
          if (best <= last) {
            console.log(`[REFRESH] No new blocks (height ${best}), skipping`);
            return NextResponse.json({ ok: true, skipped: true, best, last, mode: 'proactive' });
          }
        } else {
          throw new Error(`Unexpected status ${r.status}`);
        }
      } catch (e: any) {
        console.log(`[REFRESH] Proactive fetch failed, falling back to height check:`, e.message);
        best = await getBestHeight();
        
        if (best <= last) {
          console.log(`[REFRESH] No new blocks (height ${best}), skipping`);
          return NextResponse.json({ ok: true, skipped: true, best, last, mode: 'fallback' });
        }
      }
    } else {
      // Traditional mode: Query height
      console.log('[REFRESH] Fetching blockchain height from Blockbook...');
      best = await getBestHeight();
      console.log('[REFRESH] Current blockchain height:', best);
      
      if (last !== null && best <= last) {
        console.log('[REFRESH] Height unchanged, skipping update');
        return NextResponse.json({ ok: true, skipped: true, best, last, mode: 'traditional' });
      }
    }

    // Get previously tracked addresses from last run
    const previousTop = await getTopFile();
    const previousAddresses = previousTop?.entries.map(e => e.address) || [];
    console.log('[REFRESH] Previously tracked addresses:', previousAddresses.length);

    // Discover addresses from recent blocks
    console.log('[REFRESH] 🔍 Scanning recent blocks for addresses...');
    let discoveredAddresses: string[] = [];
    try {
      discoveredAddresses = await discoverNewAddresses(last, best, MIN_BALANCE, 10);
      console.log(`[REFRESH] Discovered ${discoveredAddresses.length} addresses from blocks`);
    } catch (e: any) {
      console.error('[REFRESH] Block scanning failed:', e?.message);
      // Continue with previous addresses if discovery fails
    }

    // Combine previous addresses with newly discovered ones
    // This ensures we re-check existing addresses for balance updates
    const allAddresses = Array.from(new Set([
      ...previousAddresses,
      ...discoveredAddresses
    ]));
    
    console.log('[REFRESH] Total addresses to check:', allAddresses.length);
    console.log('[REFRESH] - Previously tracked:', previousAddresses.length);
    console.log('[REFRESH] - Newly discovered:', discoveredAddresses.length);
    console.log('[REFRESH] - Unique total:', allAddresses.length);

    // Fetch balances directly (no HTTP call to avoid deployment protection issues)
    console.log('[REFRESH] Fetching balances...');
    const results = await getBalancesBatch(allAddresses, 8);
    console.log('[REFRESH] Received', results?.length, 'balance results');

    const now = new Date().toISOString();
    const lab: LabelMap = (labels as any) ?? {};
    const entries = results.map(e => ({
      address: e.address,
      balanceSat: e.balanceSat,
      balance: mewcString(e.balanceSat),
      updatedAt: now,
      label: lab[e.address] || undefined,
    }));

    entries.sort((a, b) => b.balanceSat - a.balanceSat);
    const top = entries.slice(0, TOPN);
    console.log('[REFRESH] Top entry balance:', top[0]?.balance, 'MEWC');

    console.log('[REFRESH] Saving to Vercel Blob...');
    await setTopFile({
      height: best,
      updatedAt: now,
      entries: top
    });
    console.log('[REFRESH] Top file saved successfully');
    
    await setLastHeight(best);
    console.log('[REFRESH] Last height saved successfully');

    console.log('[REFRESH] ✓ Refresh complete');
    return NextResponse.json({ 
      ok: true, 
      updated: true, 
      height: best, 
      count: top.length,
      totalAddressesChecked: allAddresses.length,
      newAddressesDiscovered: discoveredAddresses.length,
      addressesInTop: top.length,
      minBalanceRequired: MIN_BALANCE / 1e8,
      mode: PROACTIVE_MODE ? 'proactive' : 'traditional'
    });
  } catch (e: any) {
    console.error('[REFRESH] ✗ Error:', e?.message ?? String(e));
    console.error('[REFRESH] Stack:', e?.stack);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e), stack: e?.stack }, { status: 500 });
  }
}

