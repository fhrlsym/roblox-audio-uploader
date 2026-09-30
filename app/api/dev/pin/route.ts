import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/dev/pin — ambil PIN dari Supabase (table app_settings), fallback env
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'pin')
      .single();

    if (!error && data?.value) {
      return NextResponse.json({ pin: String(data.value) });
    }
  } catch {
    // table might not exist yet — fallthrough
  }
  return NextResponse.json({ pin: process.env.NEXT_PUBLIC_PIN || '515753' });
}

// PUT /api/dev/pin — ganti PIN di Supabase
export async function PUT(request: Request) {
  try {
    const { pin } = await request.json();
    if (!pin || typeof pin !== 'string' || pin.length < 4) {
      return NextResponse.json({ error: 'PIN minimal 4 karakter' }, { status: 400 });
    }
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'pin', value: pin, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) {
      return NextResponse.json({ error: 'Gagal simpan PIN: ' + error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, pin });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
