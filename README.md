# Meowcoin Rich List

A production-ready rich list application for Meowcoin that displays the top 200 addresses by balance. Features real-time updates via Blockbook API integration and Vercel Blob storage.

## Features

- 🔗 **Blockbook API Integration** - Simple HTTPS connection to Blockbook server
- 🔍 **Auto-Discovery** - Automatically scans new blocks for addresses with significant balances
- 📊 **Interactive Pie Chart** - Visual distribution of top holders with vibrant colors
- 🎨 **Dark Theme** - Custom Meowcoin-branded design (#000000 bg, #bb8400 primary)
- ⚡ **Auto-refresh** - Updates every minute via Vercel Cron
- 💾 **Vercel Blob Storage** - Lightweight storage with no database needed
- 🏷️ **Address Labels** - Tag known addresses (foundations, exchanges, pools)
- 🌐 **Explorer Links** - Choose between Blockbook or Classic explorer

## Setup

### 1. Install Dependencies

```bash
npm install
```

Dependencies include:
- `@vercel/blob` - Vercel Blob storage
- `zod` - Schema validation
- `recharts` - Chart components
- `swr` - Data fetching

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory (see below for template).

### 3. Enable Vercel Blob Storage

1. Go to your Vercel project dashboard
2. Navigate to **Storage** → **Blob**
3. Create a new Blob store
4. Copy the `BLOB_READ_WRITE_TOKEN` to your `.env.local`

### 4. Add Labels (Optional)

Edit `data/labels.json` to tag known addresses:

```json
{
  "MPyNGZSSZ4rbjkVJRLn3v64pMcktpEYJnU": "Meowcoin Foundation",
  "MK4Ns3NJcjcASft1FkvMSCz43CgAev4wwL": "Exchange Wallet",
  "MBrJZcCEhT1rZBqFNUJmU5g1XHGFqBJk3M": "Mining Pool"
}
```

Labels appear beneath addresses in the UI to help identify major holders.

## Local Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Important:** The list will be empty until you initialize it. Visit [http://localhost:3000/api/refresh](http://localhost:3000/api/refresh) once to populate the data.

## API Endpoints

- `/api/height` - Get current blockchain height
- `/api/balances` - POST endpoint to fetch balances for multiple addresses
- `/api/refresh` - Recompute top list (called by cron)
- `/api/top200` - Public endpoint returning the current top 200

## Deployment

### Deploy to Vercel

1. Push your code to GitHub/GitLab
2. Import the repository in Vercel
3. Add environment variables from `.env.local`
4. Enable Vercel Blob storage
5. Deploy!

The cron job (`vercel.json`) will automatically refresh the list every 2 minutes.

### First Run

After deployment, trigger the first update manually:

```
https://your-app.vercel.app/api/refresh
```

## Configuration

### Organic Block Scanning

The system **automatically discovers** addresses by scanning blocks - no manual configuration needed:

- **Scans last 10 blocks** every time blockchain height increases
- **Minimum balance threshold** - Default 10 MEWC (`MIN_BALANCE=1000000000` satoshis)
- **Updates existing addresses** - Re-checks previously tracked addresses for balance changes
- **Self-maintaining** - Addresses naturally drop off when balances fall below minimum

**How it works**: When blockchain height increases (e.g., from 1000 to 1001), the system:
1. Scans blocks 992-1001 for all addresses in transactions
2. Checks balance for each unique address
3. Combines with previously tracked addresses (to update their balances)
4. Filters addresses with balance ≥ MIN_BALANCE
5. Sorts by balance and displays top 200

**Customize minimum balance** in `.env.local`:
```bash
MIN_BALANCE=100000000000  # 1000 MEWC (whales only)
MIN_BALANCE=10000000000   # 100 MEWC  
MIN_BALANCE=1000000000    # 10 MEWC (default)
MIN_BALANCE=100000000     # 1 MEWC (track more addresses)
```

The list **grows organically** as the blockchain grows - no maintenance required!

### Explorer Options

Two explorer options are available:

- **Option A (Classic):** `https://explorer.mewccrypto.com/address/`
- **Option B (Blockbook):** `https://blockbook.mewccrypto.com/address/`

Set `EXPLORER_OPTION=explorer` for A or `blockbook` for B (default: blockbook)

### Top N Addresses

Change the number of addresses to display by modifying `TOPN` in `.env.local` (default: 200)

### Refresh Interval

Edit `vercel.json` to change the cron schedule:

```json
{
  "crons": [
    { "path": "/api/refresh", "schedule": "* * * * *" }
  ]
}
```

**Note:** Vercel cron minimum interval is 1 minute. The schedule `* * * * *` means "every minute".

## Architecture

- **Next.js 15** - App Router with API routes
- **Blockbook API** - HTTPS connection to `https://blockbook.mewccrypto.com`
- **Vercel Blob** - Stores two JSON files: `lastheight` and `top.json`
- **Smart Caching** - Only updates when blockchain height advances
- **Pooled Concurrency** - Batches address queries (8 concurrent requests) to respect server resources

## Notes

- Uses Blockbook's simple REST API (no WebSocket complexity)
- Rate limiting is handled by only updating when height changes and limiting concurrency
- All balance calculations assume 8 decimal places (standard for most cryptocurrencies)
- Works perfectly on Vercel with no special network configuration needed

## License

MIT
