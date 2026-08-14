const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'fhrlsym/minang-music';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const DEFAULT_COVER = 'rbxassetid://94215284059157';

export function formatMapDisplayName(filename) {
  let clean = filename.replace(/\.json$/i, '');
  clean = clean.replace(/^music[_]?/i, '');
  clean = clean.replace(/[_]/g, ' ').trim();
  return clean ? clean.toUpperCase() : filename;
}

export function sanitizeMapFilename(name) {
  let s = String(name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  s = s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!s) s = `map_${Date.now()}`;
  return s.startsWith('music') ? `${s}.json` : `music${s}.json`;
}

export function normalizeCoverAssetId(val) {
  let clean = String(val || '').trim();
  if (!clean) return DEFAULT_COVER;
  clean = clean.replace(/^(rbxassetid:\/\/+|rbxassetid:\/+|https?:\/\/)/i, '');
  clean = clean.replace(/^\/+/, '');
  if (/^\d+$/.test(clean)) {
    return `rbxassetid://${clean}`;
  }
  return clean ? `rbxassetid://${clean}` : DEFAULT_COVER;
}

export async function fetchGitHubMaps() {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN belum diatur pada environment backend.');
  }

  const [owner, repo] = GITHUB_REPO.split('/');
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Gagal mengambil daftar map dari GitHub (Status ${res.status})`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  const jsonFiles = data
    .filter((f) => f.type === 'file' && f.name.toLowerCase().endsWith('.json'))
    .map((f) => ({
      filename: f.name,
      displayName: formatMapDisplayName(f.name),
    }));

  return jsonFiles;
}

export async function fetchGitHubGenres(mapFilename) {
  if (!GITHUB_TOKEN) return [];

  const [owner, repo] = GITHUB_REPO.split('/');
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${mapFilename}?ref=${GITHUB_BRANCH}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    return [];
  }

  const fileData = await res.json();
  const contentStr = Buffer.from(fileData.content, 'base64').toString('utf8');
  let parsed = {};
  try {
    parsed = JSON.parse(contentStr);
  } catch {
    return [];
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return Object.keys(parsed).filter((k) => k !== 'Cover' && k !== 'Songs');
  }
  return [];
}

export async function commitSongsToGitHub({ mapFilename, genre, songs, coverAssetId = DEFAULT_COVER }) {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN belum diatur pada environment backend.');
  }
  if (!mapFilename) throw new Error('Nama file map tidak boleh kosong');
  if (!genre) throw new Error('Nama genre tidak boleh kosong');
  if (!Array.isArray(songs) || songs.length === 0) throw new Error('Tidak ada lagu yang dipilih untuk di-sync');

  const [owner, repo] = GITHUB_REPO.split('/');
  const targetGenre = genre.trim().toUpperCase();
  const effectiveCover = normalizeCoverAssetId(coverAssetId);

  // 1. Get existing file sha and content if file exists
  let fileSha;
  let existingData = {};

  const getRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${mapFilename}?ref=${GITHUB_BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
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

  // 2. Ensure target genre structure exists
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

    const existingIdx = existingSongs.findIndex((s) => Number(s.AssetId) === assetIdNum);
    if (existingIdx >= 0) {
      existingSongs[existingIdx] = songEntry;
      updatedCount++;
    } else {
      existingSongs.push(songEntry);
      addedCount++;
    }
  }

  // 3. Encode and commit
  const updatedContent = JSON.stringify(existingData, null, 2);
  const base64Content = Buffer.from(updatedContent, 'utf8').toString('base64');
  const commitMessage = `feat(music): update ${mapFilename} [${targetGenre}] (+${addedCount} songs, ~${updatedCount} updated)`;

  const putBody = {
    message: commitMessage,
    content: base64Content,
    branch: GITHUB_BRANCH,
  };
  if (fileSha) {
    putBody.sha = fileSha;
  }

  const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${mapFilename}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(putBody),
  });

  const putData = await putRes.json();
  if (!putRes.ok) {
    throw new Error(putData.message || `Gagal commit ke GitHub (Status ${putRes.status})`);
  }

  return {
    success: true,
    addedCount,
    updatedCount,
    totalCount: existingSongs.length,
    mapFilename,
    genre: targetGenre,
  };
}
