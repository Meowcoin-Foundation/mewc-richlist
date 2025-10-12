"use client";

import useSWR from "swr";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Image from "next/image";

const fetcher = (u: string) => fetch(u).then(r => r.json());

function explorerUrl(address: string) {
  const opt = process.env.NEXT_PUBLIC_EXPLORER_OPTION ?? "blockbook";
  const A = process.env.NEXT_PUBLIC_EXPLORER_A ?? "https://explorer.mewccrypto.com/address/";
  const B = process.env.NEXT_PUBLIC_EXPLORER_B ?? "https://blockbook.mewccrypto.com/address/";
  return (opt === "explorer" ? A : B) + address;
}

// Truncate address for mobile display
function truncateAddress(address: string, isMobile: boolean = false) {
  if (!isMobile || address.length <= 20) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

// Format balance for mobile (shorter notation)
function formatBalance(balance: string, isMobile: boolean = false) {
  if (!isMobile) return balance;
  const num = parseFloat(balance.replace(/,/g, ''));
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  }
  return num.toFixed(2);
}

export default function Home() {
  const { data } = useSWR("/api/top200", fetcher, { refreshInterval: 15000 });
  const entries = data?.entries ?? [];
  const height = data?.height ?? "-";
  const updatedAt = data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "-";

  // Chart data: top 10 as slices, and "Others" aggregated
  const top10 = entries.slice(0, 10);
  const others = entries.slice(10);
  const sum = entries.reduce((a: number, e: any) => a + (e.balanceSat || 0), 0);
  const chartData = [
    ...top10.map((e: any, i: number) => ({
      name: `#${i+1}`,
      value: e.balanceSat || 0,
      address: e.address,
      label: e.label,
      balance: e.balance
    })),
    { 
      name: "Others", 
      value: others.reduce((a: number, e: any) => a + (e.balanceSat || 0), 0),
      address: `${others.length} addresses`,
      balance: (others.reduce((a: number, e: any) => a + (e.balanceSat || 0), 0) / 1e8).toLocaleString(undefined, {maximumFractionDigits: 8})
    }
  ];

  // Vibrant colors that pop on dark backgrounds
  // Primary gold, then warm/cool vibrant colors
  const COLORS = [
    "#bb8400", // Primary Meowcoin gold
    "#ff6b6b", // Coral red
    "#4ecdc4", // Turquoise
    "#45b7d1", // Sky blue
    "#f9ca24", // Bright yellow
    "#6c5ce7", // Purple
    "#fd79a8", // Pink
    "#00b894", // Emerald
    "#fdcb6e", // Peach
    "#e17055", // Terra cotta
    "#74b9ff", // Light blue
    "#a29bfe", // Lavender
    "#55efc4", // Mint
    "#fab1a0", // Salmon
    "#ff7675", // Red
    "#fd79a8", // Rose
    "#636e72", // Slate (for "Others")
  ];

  return (
    <div className="container">
      <header style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Image
          src="/MeowcoinR2.png"
          alt="Meowcoin Logo"
          width={48}
          height={48}
          style={{ borderRadius: "50%", flexShrink: 0 }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 className="title" style={{ fontSize: "clamp(20px, 5vw, 32px)", margin: 0 }}>Meowcoin Rich List</h1>
          <div className="small" style={{ marginTop: 6, fontSize: "clamp(11px, 2.5vw, 13px)", wordBreak: "break-word" }}>
            Height: <span className="badge">{height}</span>
            <br className="mobile-break" />
            <span style={{ display: "inline-block", marginTop: 2 }}>Updated: {updatedAt}</span>
          </div>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 className="title" style={{ fontSize: 18, marginTop: 0, marginBottom: 12 }}>Distribution (Top 10 vs Others)</h2>
        {entries.length === 0 ? (
          <div className="small" style={{ textAlign: "center", padding: "32px 0" }}>
            Loading chart data...
          </div>
        ) : (
          <>
            <div style={{ width: "100%", height: "clamp(250px, 50vw, 300px)" }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={100} innerRadius={55}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{
                            background: '#1a1a1a',
                            border: '1px solid #2a2a2a',
                            borderRadius: '8px',
                            padding: '12px',
                            minWidth: '280px'
                          }}>
                            <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '6px' }}>
                              {data.name}
                            </div>
                            {data.label && (
                              <div style={{ color: 'var(--primary)', fontSize: '12px', marginBottom: '4px' }}>
                                {data.label}
                              </div>
                            )}
                            <div style={{ 
                              color: 'var(--muted)', 
                              fontSize: '11px', 
                              fontFamily: 'ui-monospace, monospace',
                              marginBottom: '6px',
                              wordBreak: 'break-all'
                            }}>
                              {data.address}
                            </div>
                            <div style={{ color: 'var(--primary)', fontWeight: 700 }}>
                              {data.balance} MEWC
                            </div>
                            <div style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '4px' }}>
                              {((data.value / sum) * 100).toFixed(2)}% of total
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="small" style={{ marginTop: 12, fontSize: "clamp(11px, 2.5vw, 13px)", wordBreak: "break-word" }}>
              Total (Top {entries.length}): {(sum/1e8).toLocaleString(undefined, { maximumFractionDigits: 8 })} MEWC
            </div>
          </>
        )}
      </section>

      {/* Tier Distribution Table - Commented out for now */}
      {/* {entries.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 className="title" style={{ fontSize: 18, marginTop: 0, marginBottom: 12 }}>Tier Distribution</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #2a2a2a' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text)', fontWeight: 600 }}>Tier</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text)', fontWeight: 600 }}>Balance (MEWC)</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text)', fontWeight: 600 }}>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const tiers = [
                    { label: 'Top 1-25', start: 0, end: 25 },
                    { label: 'Top 26-50', start: 25, end: 50 },
                    { label: 'Top 51-75', start: 50, end: 75 },
                    { label: 'Top 76-100', start: 75, end: 100 },
                    { label: 'Top 101-150', start: 100, end: 150 },
                    { label: 'Top 151-200', start: 150, end: 200 },
                    { label: 'Other', start: 200, end: entries.length }
                  ];

                  return tiers.map((tier, idx) => {
                    const tierEntries = entries.slice(tier.start, tier.end);
                    if (tierEntries.length === 0) return null;
                    
                    const tierBalance = tierEntries.reduce((acc: number, e: any) => acc + (e.balanceSat || 0), 0);
                    const tierBalanceMEWC = tierBalance / 1e8;
                    const tierPercentage = (tierBalance / sum) * 100;
                    
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a' }}>
                        <td style={{ padding: '12px', color: 'var(--text)' }}>
                          <span className="badge">{tier.label}</span>
                          <span className="small" style={{ marginLeft: '8px' }}>
                            ({tierEntries.length} {tierEntries.length === 1 ? 'address' : 'addresses'})
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: 'var(--text)' }}>
                          {tierBalanceMEWC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>
                          {tierPercentage.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  }).filter(Boolean);
                })()}
              </tbody>
            </table>
          </div>
        </section>
      )} */}

      <section className="card">
        <h2 className="title" style={{ fontSize: 18, marginTop: 0, marginBottom: 12 }}>Top {entries.length}</h2>
        <div>
          {entries.length === 0 ? (
            <div className="small" style={{ textAlign: "center", padding: "32px 0" }}>
              No data yet. Visit <a href="/api/refresh" className="title">/api/refresh</a> to initialize.
            </div>
          ) : (
            entries.map((e: any, i: number) => (
              <div key={e.address} className="row">
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0, flex: 1 }}>
                  <div className="badge" style={{ flexShrink: 0 }}>#{i+1}</div>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
                    <a 
                      href={explorerUrl(e.address)} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="title address-link" 
                      style={{ 
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", 
                        fontSize: "clamp(12px, 3vw, 14px)",
                        wordBreak: "break-all"
                      }}
                      title={e.address}
                    >
                      <span className="address-full">{e.address}</span>
                      <span className="address-mobile">{truncateAddress(e.address, true)}</span>
                    </a>
                    {e.label && <span className="small" style={{ fontSize: "clamp(10px, 2.5vw, 12px)" }}>{e.label}</span>}
                  </div>
                </div>
                <div className="title balance-amount" style={{ fontWeight: 700, flexShrink: 0, textAlign: "right", fontSize: "clamp(12px, 3vw, 16px)" }}>
                  <span className="balance-full">{e.balance} <span className="small">MEWC</span></span>
                  <span className="balance-mobile">{formatBalance(e.balance, true)} <span className="small">MEWC</span></span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <footer className="small" style={{ marginTop: 16, textAlign: "center", fontSize: "clamp(10px, 2.5vw, 13px)" }}>
        Theme: <span className="badge">#000000</span> · Primary: <span className="badge">#bb8400</span>
        <br className="mobile-break" />
        <span style={{ display: "inline-block", marginTop: 4 }}>Data auto-refreshes every ~15s.</span>
      </footer>
    </div>
  );
}
