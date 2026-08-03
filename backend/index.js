import express from 'express';
import cors from 'cors';
import ffmpeg from 'fluent-ffmpeg';
import { createReadStream, unlinkSync, existsSync } from 'fs';
import { createWriteStream } from 'fs';
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

async function runYtdl(args) {
  const { stdout, stderr } = await execFileAsync(YTDLP, args, {
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
      .audioCodec('libmp3lame')
      .toFormat('mp3')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
}

app.post('/api/youtube-download', async (req, res) => {
  const { url, speed = 1.0, amplify = 0 } = req.body;

  if (!url || !/youtube\.com|youtu\.be/.test(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  const videoId = getVideoId(url) || `video_${Date.now()}`;
  const tempBase = join(__dirname, `temp_${videoId}`);
  const tempAudioPath = join(__dirname, `temp_${videoId}.mp3`);
  const outputPath = join(__dirname, `output_${videoId}.mp3`);

  try {
    const title = String(await runYtdl([
      '--print', 'title',
      '--no-warnings',
      '--no-check-certificates',
      '--no-playlist',
      '--extractor-args', 'youtube:player_client=android,ios',
      url,
    ])).trim().replace(/[<>:"/\\|?*]/g, '').substring(0, 50) || `audio_${videoId}`;

    await runYtdl([
      url,
      '--output', `${tempBase}.%(ext)s`,
      '--format', 'bestaudio[ext=m4a]/bestaudio/best',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--no-warnings',
      '--no-check-certificates',
      '--no-playlist',
      '--extractor-args', 'youtube:player_client=android,ios',
      '--retries', '3',
    ]);

    const needsProcessing = parseFloat(speed) !== 1.0 || parseFloat(amplify) !== 0;

    if (needsProcessing) {
      if (!existsSync(tempAudioPath)) {
        await sleep(2000);
      }
      if (!existsSync(tempAudioPath)) {
        throw new Error('MP3 temp file not found after extraction');
      }
      if (existsSync(outputPath)) unlinkSync(outputPath);
      await runFFmpeg(tempAudioPath, outputPath, speed, amplify);
    } else {
      if (existsSync(outputPath)) unlinkSync(outputPath);
      if (!existsSync(tempAudioPath)) {
        throw new Error('MP3 temp file not found after extraction');
      }
      createReadStream(tempAudioPath).pipe(createWriteStream(outputPath));
    }

    if (existsSync(tempAudioPath)) unlinkSync(tempAudioPath);

    res.json({
      success: true,
      filename: `${title}.mp3`,
      path: outputPath,
      fileId: `output_${videoId}`,
    });

  } catch (error) {
    console.error('Download error:', error);
    for (const f of [tempAudioPath, outputPath]) {
      if (existsSync(f)) unlinkSync(f);
    }
    res.status(500).json({ error: error.message || 'Download failed' });
  }
});

app.get('/api/download-file/:fileId', (req, res) => {
  const filePath = join(__dirname, `${req.params.fileId}.mp3`);
  
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, (err) => {
    if (err) {
      console.error('Download error:', err);
    }
    if (existsSync(filePath)) {
      setTimeout(() => {
        try {
          unlinkSync(filePath);
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      }, 5000);
    }
  });
});

app.post('/api/process-audio', upload.single('file'), async (req, res) => {
  const { speed = 1.0, amplify = 0 } = req.body;
  const inputPath = req.file.path;
  const outputPath = `${inputPath}_processed.mp3`;

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
        .audioCodec('libmp3lame')
        .toFormat('mp3')
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });

    const processedFile = createReadStream(outputPath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${req.file.originalname}"`);
    
    processedFile.pipe(res);

    processedFile.on('end', () => {
      setTimeout(() => {
        if (existsSync(inputPath)) unlinkSync(inputPath);
        if (existsSync(outputPath)) unlinkSync(outputPath);
      }, 1000);
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

  const creator = creatorType === 'group' ? { groupId: creatorId } : { userId: creatorId };

  const form = new FormData();
  form.append('request', JSON.stringify({
    assetType,
    displayName,
    description,
    creationContext: { creator },
  }));
  form.append('fileContent', createReadStream(req.file.path), {
    filename: req.file.originalname || 'audio.mp3',
    contentType: req.file.mimetype || 'audio/mpeg',
  });

  const cleanup = () => {
    setTimeout(() => {
      if (req.file && existsSync(req.file.path)) unlinkSync(req.file.path);
    }, 1000);
  };

  try {
    const response = await fetch('https://apis.roblox.com/assets/v1/assets', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: form,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status || 500).json({
        error: data.message || data.code || `Upload failed (${response.status})`,
        details: data,
      });
    }

    const pathMatch = (data.path || '').match(/operations\/(.+)/);
    if (!pathMatch) {
      return res.status(500).json({ error: 'No operation ID returned', details: data });
    }
    const operationId = pathMatch[1];

    let assetId = null;
    let lastOp = null;
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((r) => setTimeout(r, 1000));
      let opData = {};
      try {
        const opRes = await fetch(
          `https://apis.roblox.com/assets/v1/operations/${operationId}`,
          { headers: { 'x-api-key': apiKey } }
        );
        opData = await opRes.json().catch(() => ({}));
      } catch {
        continue;
      }
      lastOp = opData;

      if (opData.error && !opData.done) {
        return res.status(400).json({
          error: opData.error.message || opData.error.status || 'Operation failed',
          details: opData,
        });
      }

      if (opData.done) {
        const assetPath = (opData.response && opData.response.path) || opData.path || '';
        const assetMatch = assetPath.match(/assets\/(\d+)/);
        assetId = assetMatch ? assetMatch[1] : null;
        if (opData.error && !assetId) {
          return res.status(400).json({
            error: opData.error.message || opData.error.status || 'Operation failed',
            details: opData,
          });
        }
        break;
      }
    }

    if (!assetId) {
      return res.status(500).json({
        error: 'Upload reached Roblox but the asset is still processing',
        details: lastOp,
      });
    }

    res.json({ assetId });
  } catch (error) {
    console.error('Roblox upload error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    cleanup();
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

    let status = 'Failed';
    if (data.moderationResult && data.moderationResult.moderationState === 'Rejected') {
      status = 'Copyright';
    } else if (data.state === 'Active') {
      status = 'Active';
    } else if (data.state === 'Pending') {
      status = 'Pending';
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
