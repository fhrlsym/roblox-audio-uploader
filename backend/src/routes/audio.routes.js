import { Router } from 'express';
import multer from 'multer';
import { existsSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { BACKEND_ROOT } from '../config.js';
import { downloadYoutubeMp3, fetchYoutubeVideoInfo, searchYoutube } from '../services/youtube.service.js';
import { downloadSoundCloudMp3, fetchSoundCloudInfo } from '../services/soundcloud.service.js';
import { runFFmpeg } from '../services/ffmpeg.service.js';
import { uploadToRoblox } from '../services/roblox.service.js';

const upload = multer({ dest: 'uploads/' });
const router = Router();

function sendYoutubeError(res, error, fallback) {
  res.status(error.status || 500).json({
    success: false,
    code: error.code || 'YOUTUBE_REQUEST_FAILED',
    error: error.message || fallback,
    poTokenAttempted: true,
  });
}

router.post('/youtube-download', async (req, res) => {
  const { url, speed = 1.0, amplify = 0, cookies } = req.body;

  if (!url || !/youtube\.com|youtu\.be/.test(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const { title, fileId } = await downloadYoutubeMp3({ url, speed, amplify, cookies });
    res.json({
      success: true,
      filename: `${title}.mp3`,
      fileId,
    });
  } catch (error) {
    console.error('Download error:', error);
    sendYoutubeError(res, error, 'Download failed');
  }
});

router.post('/youtube-info', async (req, res) => {
  const { url, cookies } = req.body;

  if (!url || !/youtube\.com|youtu\.be/.test(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const video = await fetchYoutubeVideoInfo(url, cookies);
    res.json({
      success: true,
      video,
    });
  } catch (error) {
    console.error('YouTube info error:', error);
    sendYoutubeError(res, error, 'Failed to fetch video info');
  }
});

router.post('/soundcloud-info', async (req, res) => {
  const { url } = req.body;
  try {
    const audio = await fetchSoundCloudInfo(url);
    res.json({ success: true, audio });
  } catch (error) {
    console.error('SoundCloud info error:', error.message);
    res.status(502).json({
      success: false,
      code: 'SOUNDCLOUD_REQUEST_FAILED',
      error: error.message || 'Gagal mengambil info SoundCloud',
    });
  }
});

router.post('/soundcloud-download', async (req, res) => {
  const { url } = req.body;
  try {
    const { title, fileId } = await downloadSoundCloudMp3({ url });
    res.json({ success: true, filename: `${title}.mp3`, fileId });
  } catch (error) {
    console.error('SoundCloud download error:', error.message);
    res.status(502).json({
      success: false,
      code: 'SOUNDCLOUD_DOWNLOAD_FAILED',
      error: error.message || 'Gagal mengunduh audio SoundCloud',
    });
  }
});

router.get('/youtube-search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const cookies = String(req.query.cookies || '').trim() || undefined;

  if (!q) {
    return res.status(400).json({ error: 'Masukkan kata kunci pencarian' });
  }

  try {
    const video = await searchYoutube(q, cookies);
    if (!video) {
      return res.status(404).json({ error: 'Video audio tidak ditemukan di YouTube' });
    }
    res.json({ success: true, video });
  } catch (error) {
    console.error('YouTube search error:', error);
    sendYoutubeError(res, error, 'Gagal mencari video di YouTube');
  }
});

router.post('/convert-file', upload.single('file'), async (req, res) => {
  const { speed = 1.0, amplify = 0 } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Missing file' });
  }

  const fileId = `converted_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const outputPath = join(BACKEND_ROOT, `${fileId}.mp3`);

  try {
    await runFFmpeg(req.file.path, outputPath, parseFloat(speed), parseFloat(amplify));
    res.json({
      success: true,
      fileId,
      filename: req.file.originalname.replace(/\.[^/.]+$/, '') + `_${speed}x.mp3`,
    });
  } catch (error) {
    console.error('Convert file error:', error);
    res.status(500).json({ error: error.message || 'Convert failed' });
  } finally {
    if (req.file && existsSync(req.file.path)) {
      try { unlinkSync(req.file.path); } catch (e) { console.error('Cleanup error:', e); }
    }
  }
});

router.get('/download-file/:fileId', (req, res) => {
  const { fileId } = req.params;

  if (!fileId || typeof fileId !== 'string' || !/^[a-zA-Z0-9_\-]+$/.test(fileId)) {
    return res.status(400).json({ error: 'Invalid fileId' });
  }

  const match = readdirSync(BACKEND_ROOT).find((f) => f.startsWith(`${fileId}.`) || f.startsWith(`${fileId}`));

  if (!match) {
    return res.status(404).json({ error: 'File not found or expired' });
  }

  const filePath = join(BACKEND_ROOT, match);
  res.sendFile(filePath);
});

router.post('/youtube-upload', async (req, res) => {
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
    const name = `${displayName || title}.mp3`;
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

export default router;
