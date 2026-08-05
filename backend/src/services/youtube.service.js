import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { LRUCache } from 'lru-cache';
import {
  BACKEND_ROOT,
  YTDLP,
  YOUTUBE_CLIENTS,
  isBotError,
  isFormatError,
  getVideoId,
  cleanYoutubeUrl,
  sleep,
  formatDuration,
} from '../config.js';
import { runFFmpeg } from './ffmpeg.service.js';

const videoInfoCache = new LRUCache({
  max: 200,
  ttl: 1000 * 60 * 60 * 24, // 24 hours
});

const execFileAsync = promisify(execFile);

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

async function runYtdlWithClients(args, cookiesFile, clients = YOUTUBE_CLIENTS) {
  let lastError;
  const candidates = [...clients];
  if (!candidates.includes('default')) {
    candidates.push('default');
  }
  for (const client of candidates) {
    try {
      if (client === 'default') {
        return await runYtdl(args, cookiesFile);
      }
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

export async function runYtCommand(args, cookiesFile) {
  try {
    return await runYtdlWithClients(args, null);
  } catch (err) {
    if (cookiesFile && isBotError(err.message)) {
      return await runYtdlWithClients(args, cookiesFile);
    }
    throw err;
  }
}

export async function downloadYoutubeMp3({ url, speed = 1.0, amplify = 0, cookies }) {
  const videoId = getVideoId(url) || `video_${Date.now()}`;
  const runId = `${videoId}_${Date.now()}`;
  const tempBase = join(BACKEND_ROOT, `temp_${runId}`);
  const outputPath = join(BACKEND_ROOT, `output_${runId}.mp3`);

  let cookiesFile = null;
  if (cookies && typeof cookies === 'string' && cookies.trim()) {
    cookiesFile = join(BACKEND_ROOT, `cookies_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
    writeFileSync(cookiesFile, cookies);
  }

  const findTempFile = () => {
    const match = readdirSync(BACKEND_ROOT).find((f) => f.startsWith(`temp_${runId}.`));
    return match ? join(BACKEND_ROOT, match) : null;
  };

  try {
    const stdout = String(await runYtCommand([
      '--print', 'title',
      '--no-simulate',
      cleanYoutubeUrl(url),
      '--output', `${tempBase}.%(ext)s`,
      '--format', 'bestaudio[ext=m4a]/bestaudio/best',
      '--downloader', 'aria2c',
      '--downloader-args', 'aria2c:-j 8 -x 8 -k 1M',
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

    let finalAudioPath = tempAudioPath;

    if (speed !== 1.0 || amplify !== 0) {
      if (existsSync(outputPath)) unlinkSync(outputPath);
      await runFFmpeg(tempAudioPath, outputPath, speed, amplify);
      if (existsSync(tempAudioPath)) unlinkSync(tempAudioPath);
      finalAudioPath = outputPath;
    }

    const actualFileId = finalAudioPath === tempAudioPath ? `temp_${runId}` : `output_${runId}`;

    return {
      title,
      outputPath: finalAudioPath,
      fileId: actualFileId,
      cleanup: () => {
        for (const f of [tempAudioPath, outputPath]) {
          if (f && existsSync(f)) unlinkSync(f);
        }
      },
    };
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

export async function searchYoutube(query, cookies) {
  let cookiesFile = null;
  if (cookies && typeof cookies === 'string' && cookies.trim()) {
    cookiesFile = join(BACKEND_ROOT, `cookies_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
    writeFileSync(cookiesFile, cookies);
  }

  try {
    const stdout = await runYtCommand([
      '--print',
      '%(id)s\n%(title)s\n%(duration_string)s\n%(thumbnail)s\n%(channel)s\n%(duration)s',
      `ytsearch1:${query}`,
    ], cookiesFile);

    const [id = '', title = '', durationString = '', thumbnail = '', channel = '', duration = '0'] =
      stdout.split('\n').map((s) => s.trim());

    if (!id) return null;

    return {
      id,
      title,
      durationString: durationString || formatDuration(parseInt(duration) || 0),
      duration: parseInt(duration) || 0,
      thumbnail,
      channel,
    };
  } catch (error) {
    console.error('YouTube search error:', error);
    return null;
  } finally {
    if (cookiesFile && existsSync(cookiesFile)) unlinkSync(cookiesFile);
  }
}

export async function fetchYoutubeVideoInfo(url, cookies) {
  const videoId = getVideoId(url);
  const cacheKey = `${videoId || url}_${Boolean(cookies)}`;
  if (videoInfoCache.has(cacheKey)) {
    return videoInfoCache.get(cacheKey);
  }

  let cookiesFile = null;
  if (cookies && typeof cookies === 'string' && cookies.trim()) {
    cookiesFile = join(BACKEND_ROOT, `cookies_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
    writeFileSync(cookiesFile, cookies);
  }

  try {
    const stdout = await runYtCommand([
      '--print',
      '%(title)s\n%(duration_string)s\n%(duration)s\n%(thumbnail)s\n%(channel)s\n%(id)s',
      '--ignore-no-formats-error',
      cleanYoutubeUrl(url),
    ], cookiesFile);

    const [title = '', durationString = '', duration = '0', thumbnail = '', channel = '', id = ''] =
      stdout.split('\n').map((s) => s.trim());

    const info = {
      id,
      title,
      durationString: durationString || formatDuration(parseInt(duration) || 0),
      duration: parseInt(duration) || 0,
      thumbnail,
      channel,
    };
    if (info.title) {
      videoInfoCache.set(cacheKey, info);
    }
    return info;
  } finally {
    if (cookiesFile && existsSync(cookiesFile)) unlinkSync(cookiesFile);
  }
}
