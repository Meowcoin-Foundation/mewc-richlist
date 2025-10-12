# Quick Start Guide

## 1. Set Up Environment Variables

Create a `.env.local` file in the root directory with the following content:

```bash
# Blockbook API URL
BLOCKBOOK_URL=https://blockbook.mewccrypto.com

# Vercel Blob Storage Token (Get this from Vercel Dashboard)
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here

# Number of top addresses to track
TOPN=200

# Explorer option: "blockbook" or "explorer"
EXPLORER_OPTION=blockbook

# Optional: Custom explorer URLs
EXPLORER_A=https://explorer.mewccrypto.com/address/
EXPLORER_B=https://blockbook.mewccrypto.com/address/
```

## 2. Get Your Vercel Blob Token

For local development:
1. Go to [vercel.com](https://vercel.com)
2. Navigate to your project → **Storage** → **Blob**
3. Create a Blob store if you haven't already
4. Click "Connect" and copy the `BLOB_READ_WRITE_TOKEN`
5. Paste it into your `.env.local`

## 3. Run Locally

```bash
# Start the development server
npm run dev

# In a separate terminal or browser, initialize the data
curl http://localhost:3000/api/refresh

# Or just visit in your browser:
# http://localhost:3000/api/refresh
```

Then open [http://localhost:3000](http://localhost:3000) to see your rich list!

## 4. Deploy to Vercel

```bash
# Push to GitHub
git add .
git commit -m "Initial Meowcoin rich list"
git push

# Then on Vercel:
# 1. Import your repository
# 2. Add environment variables from .env.local
# 3. Deploy
# 4. Visit https://your-app.vercel.app/api/refresh once to initialize
```

## Troubleshooting

### "No data yet" message
- Visit `/api/refresh` to populate the initial data
- Check that your `BLOB_READ_WRITE_TOKEN` is correct

### Blockbook connection errors
- Verify that `https://blockbook.mewccrypto.com` is accessible
- Check your firewall/network settings
- Try accessing the API directly: `curl https://blockbook.mewccrypto.com/api`

### Local testing without Vercel Blob
You need Vercel Blob even for local development. Alternatives:
- Use a free Vercel account
- Modify `lib/store.ts` to use local file storage instead

## What Happens on First Run

1. `/api/refresh` connects to Blockbook and gets the current blockchain height
2. Scans the last 10 blocks for all addresses in transactions
3. Checks balance for each unique address found
4. Filters addresses with ≥10 MEWC (configurable via `MIN_BALANCE`)
5. Sorts by balance and saves top 200 to Vercel Blob
6. The UI fetches this data and displays the chart + list
7. Vercel Cron calls `/api/refresh` every minute (proactively checks for new blocks)

## Organic Growth

The list grows automatically - **no manual address management needed**:
- 🆕 **New blocks** → New addresses discovered
- 🔄 **Existing addresses** → Balances updated
- 📉 **Low balances** → Naturally drop off the list
- 🎯 **Zero maintenance** → System manages itself

