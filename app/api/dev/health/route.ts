import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/dev/health — proxy ke backend health + Supabase stats
export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${backendUrl}/api/health`, { signal: ctrl.signal });
    clearTimeout(timeout);
    const backend = await res.json();

    // Supabase stats
    let dbStats: Record<string, unknown> = { ok: false };
    try {
      const { count } = await supabase
        .from('audio_uploads')
        .select('*', { count: 'exact', head: true });

      const { count: accountsCount } = await supabase
        .from('saved_accounts')
        .select('*', { count: 'exact', head: true });

      dbStats = {
        ok: true,
        audioUploads: count ?? 0,
        savedAccounts: accountsCount ?? 0,
      };
    } catch (e) {
      dbStats = { ok: false, error: String(e) };
    }

    return NextResponse.json({
      backend: { ok: true, ...backend },
      supabase: dbStats,
      frontend: {
        vercelUrl: process.env.VERCEL_URL || null,
        env: process.env.VERCEL_ENV || 'development',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { backend: { ok: false, error: String(e) }, supabase: { ok: false } },
      { status: 502 }
    );
  }
}
