// Cache buster to force fresh data from Cloudflare edge
function cacheBust() {
  return `_cb=${Date.now()}`;
}

export async function getBestHeight(blockbookBase = process.env.BLOCKBOOK_URL!) {
  console.log('[BLOCKBOOK] Fetching best height from', blockbookBase);
  const url = `${blockbookBase}/api/?${cacheBust()}`;
  const r = await fetch(url, { 
    cache: "no-store",
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    }
  });
  
  if (!r.ok) {
    console.error(`[BLOCKBOOK] ✗ /api/ failed: ${r.status}`);
    throw new Error(`Blockbook /api/ failed: ${r.status}`);
  }
  
  // Log Cloudflare cache status if present
  const cfCacheStatus = r.headers.get('cf-cache-status');
  if (cfCacheStatus) {
    console.log(`[BLOCKBOOK] CF-Cache-Status: ${cfCacheStatus}`);
  }
  
  const j = await r.json();
  
  // Blockbook returns: {"blockbook": {"bestHeight": 123456}, "backend": {"blocks": 123456}}
  const height = Number(j.blockbook?.bestHeight || j.backend?.blocks || 0);
  
  if (!height || isNaN(height)) {
    console.error('[BLOCKBOOK] ✗ Could not parse height from response:', JSON.stringify(j).substring(0, 300));
    throw new Error(`Failed to parse height from Blockbook API response`);
  }
  
  console.log(`[BLOCKBOOK] ✓ Best height: ${height}`);
  return height;
}

/**
 * Fetch a single address balance. details=basic is the cheapest.
 * Returns { balanceSat: number, balance: string }
 */
export async function getAddressBalance(addr: string, blockbookBase = process.env.BLOCKBOOK_URL!) {
  const url = `${blockbookBase}/api/v2/address/${addr}?details=basic&${cacheBust()}`;
  const r = await fetch(url, { 
    cache: "no-store",
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    }
  });
  
  if (!r.ok) {
    console.error(`[BLOCKBOOK] ✗ Failed to fetch ${addr}: ${r.status}`);
    throw new Error(`addr fetch failed ${addr}: ${r.status}`);
  }
  const j = await r.json();
  
  // Balance is returned as a string in satoshis (not MEWC!)
  // Example: "5908608998949008" = 59,086,089.98949008 MEWC
  const sat = parseInt(j.balance || "0", 10);
  
  return { balanceSat: sat, balance: (sat / 1e8).toLocaleString(undefined, { maximumFractionDigits: 8 }) };
}

/**
 * Tiny pooled concurrency so you don't hammer Blockbook when lists get big.
 * Keep it small (e.g., 5–10) out of respect for your server.
 */
export async function getBalancesBatch(addresses: string[], concurrency = 8, blockbookBase = process.env.BLOCKBOOK_URL!) {
  console.log(`[BLOCKBOOK] Fetching balances for ${addresses.length} addresses (concurrency: ${concurrency})`);
  const out: { address: string; balanceSat: number; confirmed?: number; unconfirmed?: number }[] = new Array(addresses.length);
  let i = 0;
  let completed = 0;
  
  async function worker() {
    while (i < addresses.length) {
      const idx = i++;
      const addr = addresses[idx];
      try {
        const { balanceSat } = await getAddressBalance(addr, blockbookBase);
        out[idx] = { address: addr, balanceSat };
        completed++;
        
        // Log progress every 10 addresses or if it has balance
        if (completed % 10 === 0 || balanceSat > 0) {
          console.log(`[BLOCKBOOK] Progress: ${completed}/${addresses.length} - ${addr}: ${balanceSat / 1e8} MEWC`);
        }
      } catch (err: any) {
        console.error(`[BLOCKBOOK] Failed ${addr}:`, err?.message);
        out[idx] = { address: addr, balanceSat: 0 };
        completed++;
      }
    }
  }
  
  const n = Math.min(concurrency, Math.max(1, addresses.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  
  const totalBalance = out.reduce((sum, r) => sum + r.balanceSat, 0);
  console.log(`[BLOCKBOOK] ✓ Batch complete: ${totalBalance / 1e8} MEWC total`);
  
  return out;
}

