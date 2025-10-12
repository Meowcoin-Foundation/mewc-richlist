# Local Testing Guide

This guide helps you test the Meowcoin Rich List locally, even though you need Vercel Blob for storage.

## Prerequisites

You need a Vercel account (free tier works fine) to get a Blob storage token.

## Getting Your Vercel Blob Token

### Option 1: Create via Vercel Dashboard (Recommended)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Create a new project or select an existing one
3. Go to **Storage** tab → **Create Database** → **Blob**
4. Name your store (e.g., "mewc-richlist-dev")
5. Click **Create**
6. Go to the **.env.local** tab
7. Copy the `BLOB_READ_WRITE_TOKEN` value

### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link your project
vercel link

# Pull environment variables (if blob is already set up)
vercel env pull .env.local
```

## Testing the API Routes

### 1. Test Height Endpoint

```bash
# Start dev server
npm run dev

# In another terminal
curl http://localhost:3000/api/height
```

Expected response:
```json
{"height": 123456}
```

### 2. Test Balances Endpoint

```bash
curl -X POST http://localhost:3000/api/balances \
  -H "Content-Type: application/json" \
  -d '{"addresses":["MK4Ns3NJcjcASft1FkvMSCz43CgAev4wwL"]}'
```

Expected response:
```json
{
  "results": [
    {
      "address": "MK4Ns3NJcjcASft1FkvMSCz43CgAev4wwL",
      "balanceSat": 1000000000,
      "confirmed": 1000000000,
      "unconfirmed": 0
    }
  ]
}
```

### 3. Initialize Data

```bash
curl http://localhost:3000/api/refresh
```

First run expected response:
```json
{
  "ok": true,
  "updated": true,
  "height": 123456,
  "count": 5
}
```

Subsequent runs (if height unchanged):
```json
{
  "ok": true,
  "skipped": true,
  "best": 123456,
  "last": 123456
}
```

### 4. View Top List

```bash
curl http://localhost:3000/api/top200
```

Or visit in browser: [http://localhost:3000](http://localhost:3000)

## Common Issues

### Issue: "Cannot find module '@vercel/blob'"

**Solution:** Run `npm install`

### Issue: "Unauthorized" or "Invalid token" for Blob

**Solutions:**
- Verify `BLOB_READ_WRITE_TOKEN` is correct in `.env.local`
- Check token has read/write permissions
- Recreate the token in Vercel dashboard

### Issue: "Electrum WS timeout"

**Solutions:**
- Check if `wss://electrum.mewccrypto.com:50004` is accessible
- Try a different Electrum server
- Check your firewall/proxy settings

### Issue: "No data yet" on homepage

**Solution:** Visit `/api/refresh` to initialize the data first

## Environment Variables for Local Testing

Your `.env.local` should look like this:

```bash
ELECTRUM_WSS=wss://electrum.mewccrypto.com:50004
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXX_your_token_here
TOPN=200
EXPLORER_OPTION=blockbook
```

## Testing Different Scenarios

### Test with empty watchlist

1. Edit `data/watchlist.json` to have an empty array
2. Visit `/api/refresh`
3. Should return `count: 0`

### Test with single address

1. Edit `data/watchlist.json`:
   ```json
   {
     "addresses": ["MK4Ns3NJcjcASft1FkvMSCz43CgAev4wwL"]
   }
   ```
2. Visit `/api/refresh`
3. View the homepage - should show 1 address

### Test labels

1. Edit `data/labels.json`:
   ```json
   {
     "MK4Ns3NJcjcASft1FkvMSCz43CgAev4wwL": "Test Label"
   }
   ```
2. Visit `/api/refresh`
3. View homepage - label should appear under the address

## Performance Testing

For testing with many addresses:

1. Generate a list of addresses (you can use real ones from block explorers)
2. Add them to `data/watchlist.json`
3. Run `/api/refresh`
4. Monitor the console for timing information

Note: Each address requires an Electrum query, so 1000 addresses might take 10-30 seconds depending on the server.

## Next Steps

Once local testing works:
1. Deploy to Vercel
2. Set up environment variables in Vercel dashboard
3. Enable Vercel Blob in production
4. The cron will automatically run every 2 minutes

