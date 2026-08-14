import { NextRequest, NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.NEXT_PUBLIC_GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'fhrlsym/minang-music';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const DEFAULT_COVER = 'rbxassetid://94215284059157';

function sanitizeMapFilename(name: string): string {
  let s = String(name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  s = s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!s) s = `map_${Date.now()}`;
  return s.startsWith('music') ? `${s}.json` : `music${s}.json`;
}

function normalizeCoverAssetId(val: string): string {
  let clean = String(val || '').trim();
  if (!clean) return DEFAULT_COVER;
  clean = clean.replace(/^(rbxassetid:\/\/+|rbxassetid:\/+|https?:\/\/)/i, '');
  clean = clean.replace(/^\/+/, '');
  if (/^\d+$/.test(clean)) {
    return `rbxassetid://${clean}`;
  }
  return clean ? `rbxassetid://${clean}` : DEFAULT_COVER;
}

export async function POST(request: NextRequest) {
  try {
    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        { error: 'GITHUB_TOKEN belum diatur pada Environment Variables server (Vercel/Railway/Hosting).' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { mapFilename, genre, songs, isNewMap, newMapName, coverAssetId } = body;

    let targetFilename = mapFilename;
    if (isNewMap) {
      targetFilename = sanitizeMapFilename(newMapName);
    }

    if (!targetFilename) {
      return NextResponse.json({ error: 'Nama map tujuan tidak boleh kosong' }, { status: 400 });
    }

    if (!genre || !String(genre).trim()) {
      return NextResponse.json({ error: 'Nama genre tidak boleh kosong' }, { status: 400 });
    }

    if (!Array.isArray(songs) || songs.length === 0) {
      return NextResponse.json({ error: 'Pilih minimal 1 lagu untuk di-sync' }, { status: 400 });
    }

    const [owner, repo] = GITHUB_REPO.split('/');
    const targetGenre = String(genre).trim().toUpperCase();
    const effectiveCover = normalizeCoverAssetId(coverAssetId);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    // 1. Fetch current map JSON if exists
    let fileSha: string | undefined = undefined;
    let existingData: Record<string, any> = {};

    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${targetFilename}?ref=${GITHUB_BRANCH}`,
      { headers, cache: 'no-store' }
    );

    if (getRes.ok) {
      const fileData = await getRes.json();
      fileSha = fileData.sha;
      try {
        const contentStr = Buffer.from(fileData.content, 'base64').toString('utf8');
        existingData = JSON.parse(contentStr);
        if (typeof existingData !== 'object' || Array.isArray(existingData)) {
          existingData = {};
        }
      } catch {
        existingData = {};
      }
    }

    // 2. Merge songs into target genre
    if (!existingData[targetGenre]) {
      existingData[targetGenre] = {
        Cover: effectiveCover,
        Songs: [],
      };
    }

    if (!Array.isArray(existingData[targetGenre].Songs)) {
      existingData[targetGenre].Songs = [];
    }

    const existingSongs = existingData[targetGenre].Songs;
    let addedCount = 0;
    let updatedCount = 0;

    for (const song of songs) {
      const assetIdNum = typeof song.AssetId === 'string' ? parseInt(song.AssetId.replace(/\D/g, ''), 10) : Number(song.AssetId);
      let speedNum = Number(song.PlaybackSpeed);
      if (!speedNum || isNaN(speedNum) || speedNum <= 0) {
        speedNum = 0.4348;
      } else {
        speedNum = parseFloat(speedNum.toFixed(4));
      }

      const songEntry = {
        AssetId: assetIdNum || 0,
        Name: String(song.Name || `Song_${assetIdNum}`).trim(),
        PlaybackSpeed: speedNum,
      };

      const existingIdx = existingSongs.findIndex((s: any) => Number(s.AssetId) === assetIdNum);
      if (existingIdx >= 0) {
        existingSongs[existingIdx] = songEntry;
        updatedCount++;
      } else {
        existingSongs.push(songEntry);
        addedCount++;
      }
    }

    // 3. Commit to GitHub
    const updatedContent = JSON.stringify(existingData, null, 2);
    const base64Content = Buffer.from(updatedContent, 'utf8').toString('base64');
    const commitMessage = `feat(music): update ${targetFilename} [${targetGenre}] (+${addedCount} songs, ~${updatedCount} updated)`;

    const putBody: Record<string, any> = {
      message: commitMessage,
      content: base64Content,
      branch: GITHUB_BRANCH,
    };
    if (fileSha) {
      putBody.sha = fileSha;
    }

    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${targetFilename}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(putBody),
    });

    const putData = await putRes.json();
    if (!putRes.ok) {
      throw new Error(putData.message || `Gagal commit ke GitHub (Status ${putRes.status})`);
    }

    return NextResponse.json({
      success: true,
      addedCount,
      updatedCount,
      totalCount: existingSongs.length,
      mapFilename: targetFilename,
      genre: targetGenre,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
