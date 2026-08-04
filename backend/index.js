import express from 'express';
import cors from 'cors';
import ffmpeg from 'fluent-ffmpeg';
import { createReadStream, writeFileSync, unlinkSync, existsSync, readdirSync, statSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execFileAsync = promisify(execFile);

const YTDLP = process.env.YTDLP_PATH ||
  join(__dirname, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

async function runYtdl(args, cookiesFile) {
  const baseArgs = ['--no-warnings', '--no-check-certificates', '--no-playlist'];
  if (cookiesFile) {
    baseArgs.push('--cookies', cookiesFile);
  }
  const { stdout } = await execFileAsync(YTDLP, [...baseArgs, ...args], {
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

const YOUTUBE_CLIENTS = ['android', 'ios', 'tv'];

function isBotError(message) {
  return /sign in to confirm|not a bot|confirm you'?re not a bot|unusual traffic|captcha|confirm.*human/i.test(message || '');
}

function isFormatError(message) {
  return /no audio formats|requested format.*not available|format.*not found|doesn't contain any.*audio/i.test(message || '');
}

async function runYtdlWithClients(args, cookiesFile, clients = YOUTUBE_CLIENTS) {
  let lastError;
  for (const client of clients) {
    try {
      return await runYtdl([...args, '--extractor-args', `youtube:player_client=${client}`], cookiesFile);
    } catch (err) {
      lastError = err;
      const msg = err.message || '';
      if (!isBotError(msg) && !isFormatError(msg)) {
        throw err;
      }
    }
  }
  throw lastError;
}

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

function getVideoId(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function clampSpeed(speed) {
  const n = parseFloat(speed);
  if (!Number.isFinite(n) || n <= 0) return 1.0;
  return Math.min(100, Math.max(0.5, n));
}

async function runFFmpeg(inputPath, outputPath, speed, amplify) {
  return new Promise((resolve, reject) => {
    const filters = [];
    const safeSpeed = clampSpeed(speed);
    if (safeSpeed !== 1.0) {
      filters.push(`atempo=${safeSpeed}`);
    }
    if (parseFloat(amplify) !== 0) {
      filters.push(`volume=${amplify}dB`);
    }

    let command = ffmpeg(inputPath);
    if (filters.length > 0) {
      command = command.audioFilters(filters);
    }

    command
      .audioBitrate(128)
      .audioCodec('libvorbis')
      .toFormat('ogg')
      .outputOptions('-map_metadata', '-1')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
}

async function downloadYoutubeMp3({ url, speed = 1.0, amplify = 0, cookies }) {
  const videoId = getVideoId(url) || `video_${Date.now()}`;
  const runId = `${videoId}_${Date.now()}`;
  const tempBase = join(__dirname, `temp_${runId}`);
  const outputPath = join(__dirname, `output_${runId}.ogg`);

  let cookiesFile = null;
  if (cookies && typeof cookies === 'string' && cookies.trim()) {
    cookiesFile = join(__dirname, `cookies_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
    writeFileSync(cookiesFile, cookies);
  }

  const findTempFile = () => {
    const match = readdirSync(__dirname).find((f) => f.startsWith(`temp_${runId}.`));
    return match ? join(__dirname, match) : null;
  };

  try {
    const stdout = String(await runYtdlWithClients([
      '--print', 'title',
      '--no-simulate',
      url,
      '--output', `${tempBase}.%(ext)s`,
      '--format', 'bestaudio[ext=m4a]/bestaudio/best',
      '--retries', '3',
    ], cookiesFile));

    const title = stdout.trim().replace(/[<>:"/\\|?*]/g, '').substring(0, 50) || `audio_${videoId}`;

    let tempAudioPath = findTempFile();
    if (!tempAudioPath) {
      await sleep(2000);
      tempAudioPath = findTempFile();
    }
    if (!tempAudioPath) {
      throw new Error('Audio temp file not found after download');
    }

    if (existsSync(outputPath)) unlinkSync(outputPath);
    await runFFmpeg(tempAudioPath, outputPath, speed, amplify);

    if (existsSync(tempAudioPath)) unlinkSync(tempAudioPath);

    return { title, outputPath, fileId: `output_${runId}`, cleanup: () => {
      for (const f of [tempAudioPath, outputPath]) {
        if (existsSync(f)) unlinkSync(f);
      }
    } };

  } catch (error) {
    const tempAudioPath = findTempFile();
    for (const f of [tempAudioPath, outputPath]) {
      if (f && existsSync(f)) unlinkSync(f);
    }
    throw error;
  } finally {
    if (cookiesFile && existsSync(cookiesFile)) unlinkSync(cookiesFile);
  }
}

async function uploadToRoblox(filePath, { assetType = 'Audio', displayName = 'Untitled', description = '', creatorType = 'user', creatorId, apiKey }) {
  const creator = creatorType === 'group' ? { groupId: creatorId } : { userId: creatorId };

  const form = new FormData();
  form.append('request', JSON.stringify({
    assetType,
    displayName,
    description,
    creationContext: { creator },
  }));
  form.append('fileContent', createReadStream(filePath), {
    filename: `${displayName}.ogg`,
    contentType: 'audio/ogg',
  });

  const response = await fetch('https://apis.roblox.com/assets/v1/assets', {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: form,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.message || data.code || `Upload failed (${response.status})`);
    err.details = data;
    err.status = response.status;
    throw err;
  }

  const pathMatch = (data.path || '').match(/operations\/(.+)/);
  if (!pathMatch) {
    const err = new Error('No operation ID returned');
    err.details = data;
    err.status = 500;
    throw err;
  }

  return pathMatch[1];
}

app.post('/api/youtube-download', async (req, res) => {
  const { url, speed = 1.0, amplify = 0, cookies } = req.body;

  if (!url || !/youtube\.com|youtu\.be/.test(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const { title, fileId } = await downloadYoutubeMp3({ url, speed, amplify, cookies });
    res.json({
      success: true,
      filename: `${title}.ogg`,
      fileId,
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message || 'Download failed' });
  }
});

app.post('/api/youtube-info', async (req, res) => {
  const { url, cookies } = req.body;

  if (!url || !/youtube\.com|youtu\.be/.test(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  let cookiesFile = null;
  if (cookies && typeof cookies === 'string' && cookies.trim()) {
    cookiesFile = join(__dirname, `cookies_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
    writeFileSync(cookiesFile, cookies);
  }

  try {
    const stdout = await runYtdlWithClients([
      '--print',
      '%(title)s\n%(duration_string)s\n%(duration)s\n%(thumbnail)s\n%(channel)s\n%(id)s',
      url,
    ], cookiesFile);

    const [title = '', durationString = '', duration = '0', thumbnail = '', channel = '', id = ''] =
      stdout.split('\n').map((s) => s.trim());

    res.json({
      success: true,
      video: {
        id,
        title,
        durationString: durationString || formatDuration(parseInt(duration) || 0),
        duration: parseInt(duration) || 0,
        thumbnail,
        channel,
      },
    });
  } catch (error) {
    console.error('YouTube info error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch video info' });
  } finally {
    if (cookiesFile && existsSync(cookiesFile)) unlinkSync(cookiesFile);
  }
});

app.post('/api/upload-to-roblox', upload.single('file'), async (req, res) => {
  const {
    assetType = 'Audio',
    displayName = 'Untitled',
    description = '',
    creatorType = 'user',
    creatorId,
    apiKey,
  } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Missing file' });
  }

  if (!creatorId) {
    return res.status(400).json({ error: 'Missing creator ID' });
  }

  try {
    const processedPath = `${req.file.path}_clean.ogg`;
    await runFFmpeg(req.file.path, processedPath, 1.0, 0);
    const operationId = await uploadToRoblox(processedPath, {
      assetType,
      displayName,
      description,
      creatorType,
      creatorId,
      apiKey,
    });
    res.json({ operationId });
  } catch (error) {
    console.error('Roblox upload error:', error);
    res.status(error.status || 500).json({
      error: error.message || 'Upload failed',
      details: error.details,
    });
  } finally {
    for (const f of [req.file && req.file.path, req.file && `${req.file.path}_clean.ogg`]) {
      if (f && existsSync(f)) {
        try {
          unlinkSync(f);
        } catch(e) {
          console.error('Cleanup error:', e);
        }
      }
    }
  }
});

app.post('/api/upload-converted', async (req, res) => {
  const {
    fileId,
    displayName,
    description = '',
    creatorType = 'user',
    creatorId,
    apiKey,
  } = req.body;

  if (!fileId) {
    return res.status(400).json({ error: 'Missing fileId' });
  }
  if (!creatorId) {
    return res.status(400).json({ error: 'Missing creator ID' });
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'Missing API key' });
  }

  const filePath = join(__dirname, `${fileId}.ogg`);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File hasil convert sudah kadaluarsa. Convert ulang dulu.' });
  }

  try {
    const operationId = await uploadToRoblox(filePath, {
      assetType: 'Audio',
      displayName: displayName || fileId,
      description,
      creatorType,
      creatorId,
      apiKey,
    });
    res.json({ operationId });
  } catch (error) {
    console.error('Roblox upload (converted) error:', error);
    res.status(error.status || 500).json({
      error: error.message || 'Upload failed',
      details: error.details,
    });
  } finally {
    if (existsSync(filePath)) {
      try { unlinkSync(filePath); } catch (e) { console.error('Cleanup error:', e); }
    }
  }
});

function sweepOldFiles() {
  const cutoff = Date.now() - 45 * 60 * 1000;
  const check = (dir, prefix) => {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const f of entries) {
      if (prefix && !f.startsWith(prefix)) continue;
      try {
        const p = join(dir, f);
        const st = statSync(p);
        if (st.isFile() && st.mtimeMs < cutoff) {
          unlinkSync(p);
          console.log('Swept old file:', f);
        }
      } catch { /* ignore */ }
    }
  };
  check(__dirname, 'output_');
  check(__dirname, 'temp_');
  check(join(__dirname, 'uploads'), '');
}
setInterval(sweepOldFiles, 10 * 60 * 1000);

app.post('/api/youtube-upload', async (req, res) => {
  const {
    url,
    speed = 1.0,
    amplify = 0,
    cookies,
    displayName,
    description = '',
    creatorType = 'user',
    creatorId,
    apiKey,
  } = req.body;

  if (!url || !/youtube\.com|youtu\.be/.test(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }
  if (!creatorId) {
    return res.status(400).json({ error: 'Missing creator ID' });
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'Missing API key' });
  }

  try {
    const { title, outputPath, cleanup } = await downloadYoutubeMp3({ url, speed, amplify, cookies });
    const name = `${displayName || title}.ogg`;
    try {
      const operationId = await uploadToRoblox(outputPath, {
        assetType: 'Audio',
        displayName: name,
        description,
        creatorType,
        creatorId,
        apiKey,
      });
      res.json({ success: true, filename: name, operationId });
    } catch (uploadErr) {
      console.error('Roblox upload error:', uploadErr);
      res.status(uploadErr.status || 500).json({
        error: uploadErr.message || 'Upload failed',
        details: uploadErr.details,
      });
    } finally {
      cleanup();
    }
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message || 'Download failed' });
  }
});

app.get('/api/operation-status/:operationId', async (req, res) => {
  const { apiKey } = req.query;

  if (!apiKey) {
    return res.status(400).json({ error: 'Missing API key' });
  }

  try {
    const opRes = await fetch(
      `https://apis.roblox.com/assets/v1/operations/${req.params.operationId}`,
      { headers: { 'x-api-key': apiKey } }
    );
    const data = await opRes.json().catch(() => ({}));

    if (!data.done) {
      return res.json({ done: false });
    }

    if (data.error) {
      const raw = typeof data.error === 'string' ? data.error : (data.error.message || data.error.status || JSON.stringify(data.error));
      const rawLower = (raw + ' ' + (data.error.status || '')).toLowerCase();
      const status = /reject|copyright|flag|moderat|denied|infring|disallowed|invalid/i.test(rawLower) ? 'Copyright' : 'Failed';
      return res.json({
        done: true,
        status,
        error: status === 'Copyright'
          ? 'Ditolak moderasi Roblox (kemungkinan hak cipta).'
          : `Upload ditolak Roblox: ${raw}`,
      });
    }

    const resp = data.response || {};
    const pathText = resp.path || data.path || '';
    const assetId = resp.assetId
      || (pathText.match(/assets\/(\d+)/) || [])[1]
      || null;

    if (!assetId) {
      return res.status(400).json({ done: true, error: 'Upload gagal tanpa ID aset. Kemungkinan ditolak moderasi Roblox.', details: data });
    }

    let status = 'Pending';
    const moderation = resp.moderationResult;
    if (moderation) {
      const m = moderation.moderationState;
      if (m === 'MODERATION_STATE_APPROVED' || m === 'Approved') status = 'Active';
      else if (m === 'MODERATION_STATE_REJECTED' || m === 'Rejected') status = 'Copyright';
      else if (m && m.includes('REJECTED')) status = 'Copyright';
    }

    res.json({ done: true, assetId, status });
  } catch (error) {
    console.error('Operation status error:', error);
    res.json({ done: false, error: 'Could not check upload status' });
  }
});

app.get('/api/asset-status/:assetId', async (req, res) => {
  const { apiKey } = req.query;
  try {
    const response = await fetch(
      `https://apis.roblox.com/assets/v1/assets/${req.params.assetId}`,
      { headers: { 'x-api-key': apiKey } }
    );
    const data = await response.json().catch(() => ({}));

    let status = 'Pending';
    const moderation = data.moderationResult && data.moderationResult.moderationState;
    if (moderation) {
      if (moderation === 'MODERATION_STATE_APPROVED' || moderation === 'Approved' || moderation === 'Active') {
        status = 'Active';
      } else if (moderation === 'MODERATION_STATE_REJECTED' || moderation === 'Rejected') {
        status = 'Copyright';
      }
    } else if (data.state) {
      if (data.state === 'Active') status = 'Active';
      else if (data.state === 'Rejected') status = 'Copyright';
      else if (data.state === 'Pending') status = 'Pending';
      else status = 'Failed';
    }

    res.json({ status, ...data });
  } catch (error) {
    console.error('Asset status error:', error);
    res.json({ status: 'Pending', error: 'Could not check status' });
  }
});

app.get('/api/roblox/lookup', async (req, res) => {
  const input = String(req.query.url || req.query.id || '').trim();
  const forcedType = req.query.type === 'group' ? 'group' : req.query.type === 'user' ? 'user' : null;

  if (!input) {
    return res.status(400).json({ error: 'Masukkan URL profile atau group Roblox' });
  }

  const userMatch = input.match(/users\/(\d+)/);
  const groupMatch = input.match(/(?:communities|groups)\/(\d+)/);
  const plainId = /^\d+$/.test(input) ? input : null;

  const id = userMatch ? userMatch[1] : groupMatch ? groupMatch[1] : plainId;
  if (!id) {
    return res.status(400).json({ error: 'Tidak bisa menemukan ID dari URL tersebut' });
  }

  let type = forcedType;
  if (!type) {
    type = userMatch ? 'user' : groupMatch ? 'group' : 'user';
  }

  const fetchWithRetry = async (url, tries = 3) => {
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(url);
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (data.errors && data.errors[0] && data.errors[0].message) {
            throw new Error(data.errors[0].message);
          }
          throw new Error(`Roblox API error (${r.status})`);
        }
        return data;
      } catch (e) {
        if (i === tries - 1) throw e;
        await sleep(500 * (i + 1));
      }
    }
    return {};
  };

  try {
    if (type === 'group') {
      const info = await fetchWithRetry(`https://groups.roblox.com/v1/groups/${id}`);
      if (!info.id) {
        return res.status(404).json({ error: 'Group tidak ditemukan' });
      }
      let thumbnail = null;
      try {
        const icons = await fetchWithRetry(
          `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${id}&size=420x420&format=Png`
        );
        if (icons.data && icons.data[0]) thumbnail = icons.data[0].imageUrl || null;
      } catch {
        thumbnail = null;
      }
      return res.json({
        result: {
          id: String(info.id),
          type: 'group',
          name: info.name,
          memberCount: info.memberCount,
          hasVerifiedBadge: !!info.hasVerifiedBadge,
          thumbnail,
        },
      });
    }

    const info = await fetchWithRetry(`https://users.roblox.com/v1/users/${id}`);
    if (!info.id) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    let thumbnail = null;
    try {
      const avatars = await fetchWithRetry(
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${id}&size=150x150&format=Png&isCircular=false`
      );
      if (avatars.data && avatars.data[0]) thumbnail = avatars.data[0].imageUrl || null;
    } catch {
      thumbnail = null;
    }
    res.json({
      result: {
        id: String(info.id),
        type: 'user',
        name: info.name,
        displayName: info.displayName,
        hasVerifiedBadge: !!info.hasVerifiedBadge,
        thumbnail,
      },
    });
  } catch (error) {
    console.error('Roblox lookup error:', error);
    res.status(500).json({ error: error.message || 'Lookup failed' });
  }
});

app.get('/api/roblox/key-info', async (req, res) => {
  const apiKey = String(req.query.apiKey || '').trim();
  if (!apiKey) {
    return res.status(400).json({ error: 'Masukkan API key terlebih dahulu' });
  }

  const fetchWithRetry = async (url, tries = 3, options = {}) => {
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(url, options);
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (data.error && data.error.message) throw new Error(data.error.message);
          if (data.errors && data.errors[0] && data.errors[0].message) throw new Error(data.errors[0].message);
          if (data.message) throw new Error(data.message);
          throw new Error(`Roblox API error (${r.status})`);
        }
        return data;
      } catch (e) {
        if (i === tries - 1) throw e;
        await sleep(500 * (i + 1));
      }
    }
    return {};
  };

  try {
    let introspect;
    try {
      const r = await fetch('https://apis.roblox.com/api-keys/v1/introspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error('introspect failed');
      introspect = data;
    } catch {
      return res.status(401).json({ error: 'API key tidak valid. Periksa kembali API key-nya.' });
    }

    if (!introspect || !introspect.authorizedUserId) {
      return res.status(401).json({ error: 'API key tidak valid. Periksa kembali API key-nya.' });
    }
    if (!introspect.enabled || introspect.expired) {
      return res.status(400).json({ error: 'API key ini tidak aktif atau sudah kedaluwarsa.' });
    }

    const ownerId = String(introspect.authorizedUserId);
    const scopes = Array.isArray(introspect.scopes) ? introspect.scopes : [];
    const scopeGroupIds = [...new Set(
      scopes.flatMap((s) => (Array.isArray(s.groupIds) ? s.groupIds : []))
    )].filter((g) => g !== '*');
    const scopeUserIds = [...new Set(
      scopes.flatMap((s) => (Array.isArray(s.userIds) ? s.userIds : []))
    )];

    const owner = await fetchWithRetry(`https://users.roblox.com/v1/users/${ownerId}`);
    let ownerThumbnail = null;
    try {
      const avatars = await fetchWithRetry(
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${ownerId}&size=150x150&format=Png&isCircular=false`
      );
      if (avatars.data && avatars.data[0]) ownerThumbnail = avatars.data[0].imageUrl || null;
    } catch {
      ownerThumbnail = null;
    }

    let audioQuota = null;
    try {
      const quota = await fetchWithRetry(
        `https://apis.roblox.com/cloud/v2/users/${ownerId}/asset-quotas`,
        2,
        { headers: { 'x-api-key': apiKey } }
      );
      const audioEntry = (Array.isArray(quota.assetQuotas) ? quota.assetQuotas : []).find(
        (q) => String(q.assetType || q.resourceType || '').toUpperCase() === 'AUDIO'
      );
      if (audioEntry) {
        audioQuota = {
          usage: audioEntry.usage != null ? Number(audioEntry.usage) : null,
          capacity: audioEntry.capacity != null ? Number(audioEntry.capacity) : null,
          period: audioEntry.period || 'MONTH',
          usageResetTime: audioEntry.usageResetTime || null,
        };
      }
    } catch {
      audioQuota = null;
    }

    const groups = [];
    for (const gid of scopeGroupIds) {
      try {
        const info = await fetchWithRetry(`https://groups.roblox.com/v1/groups/${gid}`);
        if (!info.id) continue;
        let thumb = null;
        try {
          const icons = await fetchWithRetry(
            `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${gid}&size=420x420&format=Png`
          );
          if (icons.data && icons.data[0]) thumb = icons.data[0].imageUrl || null;
        } catch {
          thumb = null;
        }
        groups.push({
          id: String(info.id),
          name: info.name,
          memberCount: info.memberCount,
          hasVerifiedBadge: !!info.hasVerifiedBadge,
          thumbnail: thumb,
        });
      } catch {
        // lewati group yang gagal di-fetch
      }
    }

    res.json({
      success: true,
      keyName: introspect.name || null,
      owner: {
        id: ownerId,
        name: owner.name,
        displayName: owner.displayName || null,
        hasVerifiedBadge: !!owner.hasVerifiedBadge,
        thumbnail: ownerThumbnail,
      },
      audioQuota,
      groups,
      scopeGroupIds,
      scopeUserIds,
    });
  } catch (error) {
    console.error('Key info error:', error);
    res.status(500).json({ error: error.message || 'Gagal memeriksa API key' });
  }
});

process.env.STARTED_AT = process.env.STARTED_AT || new Date().toISOString();

const PORT = process.env.PORT || 3001;

app.get('/api/version', (req, res) => {
  res.json({
    commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || null,
    startedAt: process.env.STARTED_AT || null,
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
