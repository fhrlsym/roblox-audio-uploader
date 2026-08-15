import { NextRequest, NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.NEXT_PUBLIC_GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'fhrlsym/minang-music';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal Server Error';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mapFile = searchParams.get('mapFile');

    if (!mapFile) {
      return NextResponse.json({ error: 'Parameter mapFile diperlukan' }, { status: 400 });
    }

    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        { error: 'GITHUB_TOKEN belum diatur pada Environment Variables server (Vercel/Railway/Hosting).' },
        { status: 500 }
      );
    }

    const [owner, repo] = GITHUB_REPO.split('/');
    const headers: Record<string, string> = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    };

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${mapFile}?ref=${GITHUB_BRANCH}`, {
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ success: true, genres: [] });
    }

    const fileData = await res.json();
    const contentStr = Buffer.from(fileData.content, 'base64').toString('utf8');
    let parsed: Record<string, unknown> = {};
    try {
      const raw = JSON.parse(contentStr);
      if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
        parsed = raw as Record<string, unknown>;
      }
    } catch {
      return NextResponse.json({ success: true, genres: [] });
    }

    const genres = Object.keys(parsed).filter((k) => k !== 'Cover' && k !== 'Songs');
    return NextResponse.json({ success: true, genres });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
