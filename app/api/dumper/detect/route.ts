import { NextRequest, NextResponse } from 'next/server';
import { detectObfuscator } from '@/lib/dumper/detector';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = String(body?.code || '');
    const result = detectObfuscator(code);
    return NextResponse.json({ success: true, detection: result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Gagal menganalisa script' },
      { status: 500 }
    );
  }
}
