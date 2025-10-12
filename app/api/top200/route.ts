import { NextResponse } from "next/server";
import { getTopFile } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  console.log('[TOP200] Fetching top file from Vercel Blob...');
  try {
    const tf = await getTopFile();
    
    if (!tf) {
      console.log('[TOP200] No data found - needs initialization via /api/refresh');
      return NextResponse.json({ 
        height: null, 
        updatedAt: null, 
        entries: [],
        message: 'No data yet. Visit /api/refresh to initialize.'
      });
    }
    
    console.log('[TOP200] ✓ Returning data: height', tf.height, 'with', tf.entries.length, 'entries');
    return NextResponse.json(tf);
  } catch (e: any) {
    console.error('[TOP200] ✗ Error fetching data:', e?.message);
    return NextResponse.json({ 
      height: null, 
      updatedAt: null, 
      entries: [],
      error: e?.message ?? String(e)
    });
  }
}

