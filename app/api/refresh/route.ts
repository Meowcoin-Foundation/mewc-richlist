import { NextResponse } from "next/server";
import labels from "@/data/labels.json";
import { getBestHeight, getBalancesBatch } from "@/lib/blockbook";
import { getLastHeight, setLastHeight, getTopFile, setTopFile, mewcString } from "@/lib/store";
import { discoverNewAddresses } from "@/lib/block-scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Increase to 5 minutes (max for Vercel Pro)

type LabelMap = Record<string, string>;

export async function GET() {
  const startTime = Date.now();
  const TIMEOUT_BUFFER = 30000; // Stop 30s before timeout
  const MAX_PROCESSING_TIME = 270000; // 4.5 minutes max
  
  const TOPN = Number(process.env.TOPN ?? 200);
  const MIN_BALANCE = Number(process.env.MIN_BALANCE || 1000000000); // 10 MEWC default
  const PROACTIVE_MODE = process.env.PROACTIVE_SCAN !== "false"; // Enabled by default
  const CATCH_UP_THRESHOLD = 50; // If more than 50 blocks behind, enter catch-up mode
  
  console.log('[REFRESH] Starting refresh process...');
  console.log('[REFRESH] TOPN:', TOPN);
  console.log('[REFRESH] MIN_BALANCE:', MIN_BALANCE / 1e8, 'MEWC');
  console.log('[REFRESH] Proactive scan:', PROACTIVE_MODE);
  console.log('[REFRESH] Catch-up threshold:', CATCH_UP_THRESHOLD, 'blocks');

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
        const url = `${blockbookBase}/api/v2/block/${nextExpected}`;
        const r = await fetch(url, { 
          cache: "no-store",
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'X-Cache-Bust': String(Date.now())
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

    // Check if we're too far behind (catch-up mode)
    const blockGap = last ? (best - last) : 0;
    const isCatchUpMode = blockGap > CATCH_UP_THRESHOLD;
    console.log(`[REFRESH] Block gap: ${blockGap}, Catch-up mode: ${isCatchUpMode}`);

    let discoveredAddresses: string[] = [];
    let addressesToCheck: string[] = [];

    if (isCatchUpMode) {
      // CATCH-UP MODE: Skip block scanning, just increment height with existing addresses
      console.log('[REFRESH] 🚀 CATCH-UP MODE: Skipping block scan, using top 100 addresses only');
      addressesToCheck = previousAddresses.slice(0, 100); // Only check top 100 to save time
    } else {
      // NORMAL MODE: Scan blocks and check more addresses
      console.log('[REFRESH] 🔍 NORMAL MODE: Scanning recent blocks for addresses...');
      try {
        // Check timeout before expensive operation
        if (Date.now() - startTime > MAX_PROCESSING_TIME - 120000) { // 2 min buffer for scanning
          console.log('[REFRESH] ⏰ Approaching timeout, skipping block scanning');
        } else {
          discoveredAddresses = await discoverNewAddresses(last, best, MIN_BALANCE, 5); // Reduced from 10 to 5 blocks
          console.log(`[REFRESH] Discovered ${discoveredAddresses.length} addresses from blocks`);
        }
      } catch (e: any) {
        console.error('[REFRESH] Block scanning failed:', e?.message);
      }

      // Smart address selection: Top 150 from previous + all new discoveries
      const priorityAddresses = previousAddresses.slice(0, 150); // Top 150 only
      addressesToCheck = Array.from(new Set([
        ...priorityAddresses,
        ...discoveredAddresses
      ]));
    }
    
    console.log('[REFRESH] Addresses to check:', addressesToCheck.length);
    console.log('[REFRESH] - Priority previous:', Math.min(previousAddresses.length, isCatchUpMode ? 100 : 150));
    console.log('[REFRESH] - Newly discovered:', discoveredAddresses.length);
    console.log('[REFRESH] - Total unique:', addressesToCheck.length);

    // Check timeout before balance fetching
    if (Date.now() - startTime > MAX_PROCESSING_TIME - 90000) { // 1.5 min buffer
      console.log('[REFRESH] ⏰ Approaching timeout, using minimal address set');
      addressesToCheck = addressesToCheck.slice(0, 50); // Emergency fallback
    }

    // Fetch balances with higher concurrency
    console.log('[REFRESH] Fetching balances...');
    const results = await getBalancesBatch(addressesToCheck, 16); // Increased from 8 to 16
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

    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`[REFRESH] ✓ Refresh complete in ${processingTime.toFixed(1)}s`);
    
    return NextResponse.json({ 
      ok: true, 
      updated: true, 
      height: best, 
      count: top.length,
      totalAddressesChecked: addressesToCheck.length,
      newAddressesDiscovered: discoveredAddresses.length,
      addressesInTop: top.length,
      blockGap: blockGap,
      catchUpMode: isCatchUpMode,
      processingTimeSeconds: Math.round(processingTime),
      minBalanceRequired: MIN_BALANCE / 1e8,
      mode: isCatchUpMode ? 'catch-up' : (PROACTIVE_MODE ? 'proactive' : 'traditional')
    });
  } catch (e: any) {
    console.error('[REFRESH] ✗ Error:', e?.message ?? String(e));
    console.error('[REFRESH] Stack:', e?.stack);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e), stack: e?.stack }, { status: 500 });
  }
}

