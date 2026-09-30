import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Proxy to the backend's in-memory log ring buffer.
function backendUrl() {
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since') || '0';
  const limit = searchParams.get('limit') || '200';
  const level = searchParams.get('level') || 'all';

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      `${backendUrl()}/api/logs?since=${encodeURIComponent(since)}&limit=${encodeURIComponent(limit)}&level=${encodeURIComponent(level)}`,
      { signal: ctrl.signal, cache: 'no-store' },
    );
    clearTimeout(timeout);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ logs: [], error: String(e) }, { status: 502 });
  }
}

export async function DELETE() {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${backendUrl()}/api/logs`, {
      method: 'DELETE',
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    return NextResponse.json({ ok: res.ok });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
