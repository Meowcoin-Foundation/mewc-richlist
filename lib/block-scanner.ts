import { getAddressBalance } from "./blockbook";

/**
 * Fetch addresses from a block
 */
export async function getBlockAddresses(height: number, blockbookBase = process.env.BLOCKBOOK_URL!): Promise<string[]> {
  console.log(`[SCANNER] Fetching block ${height}...`);
  const url = `${blockbookBase}/api/v2/block/${height}?_cb=${Date.now()}`;
  const r = await fetch(url, { 
    cache: "no-store",
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    }
  });
  
  if (!r.ok) {
    console.error(`[SCANNER] ✗ Failed to fetch block ${height}: ${r.status}`);
    return [];
  }
  
  const block = await r.json();
  const addresses = new Set<string>();
  
  // Extract addresses from all transactions
  if (block.txs && Array.isArray(block.txs)) {
    for (const tx of block.txs) {
      // Input addresses
      if (tx.vin && Array.isArray(tx.vin)) {
        for (const input of tx.vin) {
          if (input.addresses && Array.isArray(input.addresses)) {
            input.addresses.forEach((addr: string) => {
              // Filter out OP_RETURN and other non-address entries
              if (addr && !addr.startsWith('OP_RETURN') && addr.length > 20) {
                addresses.add(addr);
              }
            });
          }
        }
      }
      
      // Output addresses
      if (tx.vout && Array.isArray(tx.vout)) {
        for (const output of tx.vout) {
          if (output.addresses && Array.isArray(output.addresses)) {
            output.addresses.forEach((addr: string) => {
              // Filter out OP_RETURN and other non-address entries
              if (addr && !addr.startsWith('OP_RETURN') && addr.length > 20) {
                addresses.add(addr);
              }
            });
          }
        }
      }
    }
  }
  
  const addressList = Array.from(addresses);
  console.log(`[SCANNER] ✓ Found ${addressList.length} unique addresses in block ${height}`);
  return addressList;
}

/**
 * Scan recent blocks and discover new addresses with significant balances
 */
export async function discoverNewAddresses(
  lastHeight: number | null,
  currentHeight: number,
  minBalance: number = 1000000000, // 10 MEWC minimum
  maxBlocksToScan: number = 10
): Promise<string[]> {
  const startHeight = lastHeight ? Math.max(lastHeight + 1, currentHeight - maxBlocksToScan) : currentHeight;
  const endHeight = currentHeight;
  
  console.log(`[SCANNER] Discovering addresses from blocks ${startHeight} to ${endHeight}...`);
  
  const allAddresses = new Set<string>();
  const blocksToScan = endHeight - startHeight + 1;
  
  if (blocksToScan > maxBlocksToScan) {
    console.log(`[SCANNER] Too many blocks (${blocksToScan}), limiting to last ${maxBlocksToScan}`);
  }
  
  // Scan blocks (up to maxBlocksToScan recent ones)
  const scanStart = Math.max(startHeight, endHeight - maxBlocksToScan + 1);
  for (let height = scanStart; height <= endHeight; height++) {
    try {
      const addresses = await getBlockAddresses(height);
      addresses.forEach(addr => allAddresses.add(addr));
    } catch (e: any) {
      console.error(`[SCANNER] Error scanning block ${height}:`, e?.message);
    }
  }
  
  console.log(`[SCANNER] Found ${allAddresses.size} total unique addresses in ${endHeight - scanStart + 1} blocks`);
  
  // Filter addresses with minimum balance (in parallel batches)
  const addressList = Array.from(allAddresses);
  const significantAddresses: string[] = [];
  
  console.log(`[SCANNER] Checking balances for ${addressList.length} addresses (min: ${minBalance / 1e8} MEWC)...`);
  
  // Check in batches of 20 at a time
  const batchSize = 20;
  for (let i = 0; i < addressList.length; i += batchSize) {
    const batch = addressList.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (addr) => {
        try {
          const { balanceSat } = await getAddressBalance(addr);
          if (balanceSat >= minBalance) {
            console.log(`[SCANNER] 💰 Found significant balance: ${addr} = ${balanceSat / 1e8} MEWC`);
            return addr;
          }
          return null;
        } catch {
          return null;
        }
      })
    );
    
    results.forEach(addr => {
      if (addr) significantAddresses.push(addr);
    });
    
    console.log(`[SCANNER] Progress: ${Math.min(i + batchSize, addressList.length)}/${addressList.length} checked`);
  }
  
  console.log(`[SCANNER] ✓ Discovered ${significantAddresses.length} addresses with significant balances`);
  return significantAddresses;
}

