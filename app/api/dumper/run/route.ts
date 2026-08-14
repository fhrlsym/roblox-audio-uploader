import { NextRequest, NextResponse } from 'next/server';
import { runDumperSandbox } from '@/lib/dumper/sandbox';
import { DumperEngine } from '@/lib/dumper/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// Vercel serverless cannot spawn long subprocesses, so the full dump (the
// proven engines) runs on the Railway backend. If the backend is unreachable
// (e.g. sleeping on the free plan), fall back to honest static analysis.
export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    const body = await request.json();
    const code = String(body?.code || '');
    const engine = (body?.engine || 'auto') as DumperEngine;

    if (!code.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Kode input tidak boleh kosong',
      });
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${BACKEND_URL}/api/dumper/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, engine }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data?.success) return NextResponse.json(data);
      }
    } catch {
      // backend unreachable -> fall through to static
    }

    // Backend unavailable: honest client-side static analysis.
    const fallback = runDumperSandbox(code, engine);
    const result = {
      ...fallback,
      executionTimeMs: fallback.executionTimeMs + (Date.now() - start),
    };
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Terjadi kesalahan saat menjalankan dumper';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}