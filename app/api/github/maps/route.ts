import { NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'fhrlsym/minang-music';

function formatMapDisplayName(filename: string): string {
  let clean = filename.replace(/\.json$/i, '');
  clean = clean.replace(/^music[_]?/i, '');
  clean = clean.replace(/[_]/g, ' ').trim();
  return clean ? clean.toUpperCase() : filename;
}

export async function GET() {
  try {
    const [owner, repo] = GITHUB_REPO.split('/');
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/`, {
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message || `Gagal membaca file dari GitHub (Status ${res.status})` },
        { status: res.status }
      );
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      return NextResponse.json({ success: true, maps: [] });
    }

    const maps = data
      .filter((f: any) => f.type === 'file' && f.name.toLowerCase().endsWith('.json'))
      .map((f: any) => ({
        filename: f.name,
        displayName: formatMapDisplayName(f.name),
      }));

    return NextResponse.json({ success: true, maps });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
