# Deployment Guide

## Complete .env Configuration

Here's the complete `.env.local` for local development (and environment variables for Vercel):

```bash
# ============================================
# REQUIRED - Blockbook API
# ============================================
BLOCKBOOK_URL=https://blockbook.mewccrypto.com

# ============================================
# REQUIRED - Vercel Blob Storage
# ============================================
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here

# ============================================
# OPTIONAL - Block Scanning Settings  
# ============================================

# Minimum balance to include in rich list (in satoshis)
# Default: 1000000000 (10 MEWC)
# Examples:
#   100000000 = 1 MEWC
#   1000000000 = 10 MEWC
#   10000000000 = 100 MEWC
MIN_BALANCE=1000000000

# ============================================
# OPTIONAL - Display Settings
# ============================================

# Number of top addresses to track and display (default: 200)
TOPN=200

# Explorer option: "blockbook" or "explorer" (default: blockbook)
EXPLORER_OPTION=blockbook

# Custom explorer URLs (optional, these are the defaults)
EXPLORER_A=https://explorer.mewccrypto.com/address/
EXPLORER_B=https://blockbook.mewccrypto.com/address/

# ============================================
# OPTIONAL - For Production
# ============================================

# Base URL for API calls (auto-detected on Vercel)
# Only needed if you have custom routing
# NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## Vercel Deployment Steps

### 1. Push to GitHub

```bash
git add .
git commit -m "Meowcoin rich list with auto-discovery"
git push origin main
```

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your repository
3. Framework Preset: **Next.js**
4. Leave build settings as default

### 3. Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

```
BLOCKBOOK_URL=https://blockbook.mewccrypto.com
BLOB_READ_WRITE_TOKEN=(get from Blob storage)
TOPN=200
MIN_BALANCE=1000000000
EXPLORER_OPTION=blockbook
```

### 4. Enable Vercel Blob

1. Go to Storage tab
2. Click **Create Database** → **Blob**
3. Name it (e.g., "mewc-richlist")
4. Copy the `BLOB_READ_WRITE_TOKEN`
5. Add it to Environment Variables

### 5. Deploy

1. Click **Deploy**
2. Wait for build to complete
3. Visit your app URL
4. Initialize data: `https://your-app.vercel.app/api/refresh`

### 6. Verify Cron is Running

The cron job (`vercel.json`) should automatically be detected:
- Go to Dashboard → Cron Jobs
- Verify `/api/refresh` runs every minute
- Check logs to see executions

**Why every minute?** 
- Meowcoin has ~1 minute blocks
- Proactive mode tries `last_height + 1` directly
- If we fall behind, we catch up within 1 minute
- Vercel cron doesn't support sub-minute intervals (45s not possible)

## How Organic Block Scanning Works

Every minute (proactively checking for new blocks):

1. **Fetch Latest Height** - Queries Blockbook for current height
2. **Compare with Last** - Checks if height has increased
3. **Scan Recent Blocks** - If yes, scans last 10 blocks for all transactions
4. **Extract Addresses** - Collects all input/output addresses from transactions  
5. **Combine with Previous** - Merges with previously tracked addresses (to update balances)
6. **Check All Balances** - Queries current balance for each address
7. **Filter Significant** - Keeps only addresses with balance ≥ MIN_BALANCE
8. **Update Top 200** - Sorts by balance and stores top N to Vercel Blob

**Key Features:**
- 🔄 **Auto-updating** - Existing addresses get their balances refreshed
- 📉 **Natural pruning** - Addresses drop off when balance falls below minimum
- 📈 **Organic growth** - New addresses added as they appear in blocks
- 🎯 **Zero maintenance** - No manual address lists to manage

## Monitoring

### Check if Block Scanning is Working

Visit `/api/refresh` and look for:

```json
{
  "ok": true,
  "updated": true,
  "height": 1621106,
  "count": 19,
  "totalAddressesChecked": 45,
  "newAddressesDiscovered": 19,
  "addressesInTop": 19,
  "minBalanceRequired": 10
}
```

- `newAddressesDiscovered` - Addresses found in recent blocks
- `totalAddressesChecked` - Total unique addresses checked (new + previous)
- `addressesInTop` - How many made it into the top list
- `minBalanceRequired` - Minimum balance in MEWC

### View Logs in Vercel

1. Go to Dashboard → Logs
2. Filter by `/api/refresh`
3. Look for `[SCANNER]` and `[BLOCKBOOK]` log entries

Example logs:
```
[REFRESH] 🔍 Scanning recent blocks for addresses...
[REFRESH] Previously tracked addresses: 19
[SCANNER] Discovering addresses from blocks 1621097 to 1621106...
[SCANNER] Found 245 unique addresses in 10 blocks
[SCANNER] 💰 Found significant balance: MNgU... = 19877888.78 MEWC
[SCANNER] ✓ Discovered 19 addresses with significant balances
[REFRESH] Total addresses to check: 38
[REFRESH] - Previously tracked: 19
[REFRESH] - Newly discovered: 19
```

## Customization

### Change Minimum Balance

To only track whales (>1000 MEWC):

```bash
MIN_BALANCE=100000000000  # 1000 MEWC in satoshis
```


### Change Cron Frequency

Edit `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/refresh", "schedule": "*/2 * * * *" }  // Every 2 minutes
  ]
}
```

**Note:** Minimum is 1 minute (`* * * * *`). Sub-minute intervals not supported by Vercel.

### Increase Scan Range

Edit `lib/block-scanner.ts`, line 52:

```typescript
maxBlocksToScan: number = 20  // Scan 20 blocks instead of 10
```

## Troubleshooting

### "Too many requests" from Blockbook

Reduce scan range or increase delays between requests in `lib/block-scanner.ts`.

### Block scanning not finding addresses

- Check `MIN_BALANCE` isn't too high
- Verify blocks have transactions with addresses meeting minimum
- Check logs for `[SCANNER]` errors

### Cron not running

- Verify `vercel.json` exists in root
- Check Dashboard → Cron Jobs
- Manually trigger: visit `/api/refresh` in browser

## Performance Tips

1. **Batch Size**: Default is 20 addresses checked in parallel. Adjust in `block-scanner.ts` if needed.
2. **Scan Range**: Default 10 blocks. Reduce if Blockbook is slow.
3. **Min Balance**: Higher minimum = fewer addresses to check = faster.
4. **Cron Frequency**: Default 2 minutes. Increase to 5 minutes if you prefer.

## Cost Considerations

Vercel Free Tier:
- ✅ **Hobby plan supports Blob storage**
- ✅ **Cron jobs included**
- ✅ **100GB bandwidth/month**
- ⚠️ Function executions: 100GB-hours/month (should be plenty)

If you exceed limits, auto-discovery will continue but may need Pro plan ($20/month).

