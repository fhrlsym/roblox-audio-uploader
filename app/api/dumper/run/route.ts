import { NextRequest, NextResponse } from 'next/server';
import { runDumperSandbox } from '@/lib/dumper/sandbox';
import { DumperEngine } from '@/lib/dumper/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = String(body?.code || '');
    const engine = (body?.engine || 'auto') as DumperEngine;

    const result = runDumperSandbox(code, engine);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Terjadi kesalahan saat menjalankan dumper' },
      { status: 500 }
    );
  }
}
