import express from 'express';
import cors from 'cors';
import ffmpeg from 'fluent-ffmpeg';
import { createReadStream, createWriteStream, writeFileSync, unlinkSync, existsSync } from 'fs';
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
  const { stdout, stderr } = await execFileAsync(YTDLP, [...baseArgs, ...args], {
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
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

async function runFFmpeg(inputPath, outputPath, speed, amplify) {
  return new Promise((resolve, reject) => {
    const filters = [];
    if (parseFloat(speed) !== 1.0) {
      filters.push(`atempo=${speed}`);
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
  const tempBase = join(__dirname, `temp_${videoId}`);
  const tempAudioPath = join(__dirname, `temp_${videoId}.ogg`);
  const outputPath = join(__dirname, `output_${videoId}.ogg`);

  let cookiesFile = null;
  if (cookies && typeof cookies === 'string' && cookies.trim()) {
    cookiesFile = join(__dirname, `cookies_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
    writeFileSync(cookiesFile, cookies);
  }

  try {
    const title = String(await runYtdl([
      '--print', 'title',
      '--extractor-args', 'youtube:player_client=mweb,android_vr,web_safari,android',
      url,
    ], cookiesFile)).trim().replace(/[<>:"/\\|?*]/g, '').substring(0, 50) || `audio_${videoId}`;

    await runYtdl([
      url,
      '--output', `${tempBase}.%(ext)s`,
      '--format', 'bestaudio[ext=m4a]/bestaudio/best',
      '--extract-audio',
      '--audio-format', 'vorbis',
      '--audio-quality', '0',
      '--extractor-args', 'youtube:player_client=mweb,android_vr,web_safari,android',
      '--retries', '3',
    ], cookiesFile);

    if (!existsSync(tempAudioPath)) {
      await sleep(2000);
    }
    if (!existsSync(tempAudioPath)) {
      throw new Error('OGG temp file not found after extraction');
    }

    if (existsSync(outputPath)) unlinkSync(outputPath);
    await runFFmpeg(tempAudioPath, outputPath, speed, amplify);

    if (existsSync(tempAudioPath)) unlinkSync(tempAudioPath);

    return { title, outputPath, fileId: `output_${videoId}`, cleanup: () => {
      for (const f of [tempAudioPath, outputPath]) {
        if (existsSync(f)) unlinkSync(f);
      }
    } };

  } catch (error) {
    for (const f of [tempAudioPath, outputPath]) {
      if (existsSync(f)) unlinkSync(f);
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
    const { title, outputPath, fileId, cleanup } = await downloadYoutubeMp3({ url, speed, amplify, cookies });
    res.json({
      success: true,
      filename: `${title}.ogg`,
      path: outputPath,
      fileId,
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message || 'Download failed' });
  }
});

app.post('/api/youtube-info', async (req, res) => {
  const { url } = req.body;

  if (!url || !/youtube\.com|youtu\.be/.test(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const stdout = await runYtdl([
      '--print',
      '%(title)s\n%(duration_string)s\n%(duration)s\n%(thumbnail)s\n%(channel)s\n%(id)s',
      '--extractor-args', 'youtube:player_client=mweb,android_vr,web_safari,android',
      url,
    ]);

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
  }
});

app.get('/api/download-file/:fileId', (req, res) => {
  const filePath = join(__dirname, `${req.params.fileId}.ogg`);
  
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, (err) => {
    if (err) {
      console.error('Download error:', err);
    }
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    }
  });
});

app.post('/api/process-audio', upload.single('file'), async (req, res) => {
  const { speed = 1.0, amplify = 0 } = req.body;
  const inputPath = req.file.path;
  const outputPath = `${inputPath}_processed.ogg`;

  try {
    await new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      const filters = [];
      if (parseFloat(speed) !== 1.0) {
        filters.push(`atempo=${speed}`);
      }
      if (parseFloat(amplify) !== 0) {
        filters.push(`volume=${amplify}dB`);
      }

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

    const processedFile = createReadStream(outputPath);
    res.setHeader('Content-Type', 'audio/ogg');
    res.setHeader('Content-Disposition', `attachment; filename="${req.file.originalname.replace(/\.\w+$/, '')}.ogg"`);
    
    processedFile.pipe(res);

    processedFile.on('close', () => {
      if (existsSync(inputPath)) unlinkSync(inputPath);
      if (existsSync(outputPath)) unlinkSync(outputPath);
    });

  } catch (error) {
    console.error('Processing error:', error);
    if (existsSync(inputPath)) unlinkSync(inputPath);
    if (existsSync(outputPath)) unlinkSync(outputPath);
    res.status(500).json({ error: error.message });
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

    if (data.error && !data.done) {
      return res.status(400).json({ done: true, error: data.error.message || data.error.status || 'Operation failed' });
    }

    if (!data.done) {
      return res.json({ done: false });
    }

    const assetPath = (data.response && data.response.path) || data.path || '';
    const assetMatch = assetPath.match(/assets\/(\d+)/);
    const assetId = assetMatch ? assetMatch[1] : null;

    if (!assetId) {
      return res.status(400).json({ done: true, error: 'Asset upload failed without an asset ID', details: data });
    }

    let status = 'Pending';
    const moderation = data.response && data.response.moderationResult;
    if (moderation) {
      const m = moderation.moderationState;
      if (m === 'MODERATION_STATE_APPROVED') status = 'Active';
      else if (m === 'MODERATION_STATE_REJECTED') status = 'Copyright';
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

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
