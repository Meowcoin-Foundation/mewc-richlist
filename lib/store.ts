import { put, head, del, list } from "@vercel/blob";
import { z } from "zod";

const TopEntry = z.object({
  address: z.string(),
  balanceSat: z.number(),
  balance: z.string(),
  updatedAt: z.string(),
  label: z.string().optional(),
});
export type TopEntry = z.infer<typeof TopEntry>;

const TopFile = z.object({
  height: z.number(),
  updatedAt: z.string(),
  entries: z.array(TopEntry),
});
export type TopFile = z.infer<typeof TopFile>;

const LAST_HEIGHT_KEY = "mewc-richlist-lastheight.json";
const TOP_FILE_KEY    = "mewc-richlist-top.json";

async function readBlobJSON<T>(key: string): Promise<T | null> {
  try {
    console.log(`[STORE] Reading blob: ${key}`);
    const blob = await head(key);
    if (!blob) {
      console.log(`[STORE] Blob not found: ${key} (will be created on first refresh)`);
      return null;
    }
    console.log(`[STORE] Blob found: ${key}, fetching from ${blob.url}`);
    const res = await fetch(blob.url);
    if (!res.ok) {
      console.error(`[STORE] Failed to fetch blob ${key}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    console.log(`[STORE] ✓ Successfully read blob: ${key}`);
    return data as T;
  } catch (e: any) {
    // Blob doesn't exist yet - this is normal on first run
    if (e?.message?.includes('does not exist')) {
      console.log(`[STORE] Blob ${key} doesn't exist yet (will be created on first refresh)`);
      return null;
    }
    console.error(`[STORE] Error reading blob ${key}:`, e?.message);
    return null;
  }
}

async function writeBlobJSON<T>(key: string, data: T): Promise<void> {
  try {
    console.log(`[STORE] Writing blob: ${key}`);
    const jsonStr = JSON.stringify(data);
    console.log(`[STORE] Data size: ${jsonStr.length} bytes`);
    
    // Use put with addRandomSuffix: false and allowOverwrite: true to overwrite in place
    // This avoids the race condition of delete + create
    const result = await put(key, jsonStr, { 
      contentType: "application/json", 
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0
    });
    console.log(`[STORE] ✓ Successfully wrote blob: ${key} at ${result.url}`);
  } catch (e: any) {
    console.error(`[STORE] ✗ Error writing blob ${key}:`, e?.message);
    throw e;
  }
}

export async function getLastHeight(): Promise<number | null> {
  const j = await readBlobJSON<{ height: number }>(LAST_HEIGHT_KEY);
  return j?.height ?? null;
}
export async function setLastHeight(height: number) {
  await writeBlobJSON(LAST_HEIGHT_KEY, { height });
}

export async function getTopFile(): Promise<TopFile | null> {
  const j = await readBlobJSON<TopFile>(TOP_FILE_KEY);
  if (!j) return null;
  return TopFile.parse(j);
}
export async function setTopFile(tf: TopFile) {
  await writeBlobJSON(TOP_FILE_KEY, tf);
}

// utils
export function satsToMEWC(sats: number) {
  return sats / 1e8; // adjust if Meowcoin differs; typically 8 decimals
}
export function mewcString(sats: number) {
  return satsToMEWC(sats).toLocaleString(undefined, { maximumFractionDigits: 8 });
}

