import { NextRequest, NextResponse } from 'next/server';

const GOOFYSCATOR_URL = process.env.GOOFYSCATOR_URL || 'https://goofyscator.lua.cz';

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    const body = await request.json();
    const source = String(body?.source || '');
    const settings = body?.settings || {};

    if (!source.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Source code tidak boleh kosong',
      });
    }

    // Proxy to Goofyscator V8 API
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    let res: Response;
    try {
      res = await fetch(`${GOOFYSCATOR_URL}/obfuscate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, settings }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json({
        success: false,
        error: `Goofyscator API error (Status ${res.status}): ${text.slice(0, 200)}`,
      });
    }

    const data = await res.json();

    if (data.status !== 'success' || !data.result) {
      return NextResponse.json({
        success: false,
        error: data.error || data.message || 'Goofyscator mengembalikan response tidak valid',
      });
    }

    return NextResponse.json({
      success: true,
      result: data.result,
      settings: data.settings || settings,
      executionTimeMs: Date.now() - start,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({
        success: false,
        error: 'Goofyscator API timeout (30 detik). Script mungkin terlalu besar.',
      }, { status: 504 });
    }
    const msg = error instanceof Error ? error.message : 'Terjadi kesalahan saat obfuscate';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
