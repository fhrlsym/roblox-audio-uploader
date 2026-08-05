import { NextResponse } from 'next/server';

// Build timestamp generated at build time
const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_ID || `build_${Date.now()}`;

export async function GET() {
  return NextResponse.json(
    { version: BUILD_VERSION },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
}
