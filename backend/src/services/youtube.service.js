import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { LRUCache } from 'lru-cache';
import {
  BACKEND_ROOT,
  YTDLP,
  YOUTUBE_POT_PROVIDER_URL,
  isBotError,
  isCookieError,
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

function prepareCookiesFile(cookies) {
  if (!cookies || typeof cookies !== 'string' || !cookies.trim()) return null;
  let text = cookies.trim();
  if (!text.startsWith('# Netscape')) {
    text = `# Netscape HTTP Cookie File\n# http://curl.haxx.se/rfc/cookie_spec.html\n# This is a generated file! Do not edit.\n\n` + text;
  }
  const filePath = join(BACKEND_ROOT, `cookies_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
  writeFileSync(filePath, text.replace(/\r\n/g, '\n') + '\n');
  return filePath;
}

function errorText(error) {
  return [error?.stderr, error?.stdout, error?.message].filter(Boolean).join('\n');
}

function redactSensitiveText(value) {
  return String(value || '').replace(/(https?:\/\/)[^\s:@/]+:[^\s@/]+@/gi, '$1[credentials]@');
}

function createYoutubeError(error, cookiesFile) {
  const raw = redactSensitiveText(errorText(error));
  const youtubeError = new Error('Gagal mengakses YouTube.');
  youtubeError.status = 502;

  if (isCookieError(raw)) {
    youtubeError.code = 'YOUTUBE_COOKIES_EXPIRED';
    youtubeError.status = 401;
    youtubeError.message = 'Cookies YouTube sudah tidak valid atau kedaluwarsa. Export cookies baru lalu coba lagi.';
    return youtubeError;
  }

  if (isBotError(raw)) {
    if (cookiesFile) {
      youtubeError.code = 'YOUTUBE_ACCESS_BLOCKED';
      youtubeError.status = 403;
      youtubeError.message = 'YouTube masih menolak akses setelah PO Token dan cookies dicoba. Coba lagi beberapa saat.';
    } else {
      youtubeError.code = 'YOUTUBE_AUTH_REQUIRED';
      youtubeError.status = 401;
      youtubeError.message = 'PO Token belum cukup untuk video ini. Tambahkan cookies YouTube lalu coba lagi.';
    }
    return youtubeError;
  }

  if (isFormatError(raw)) {
    youtubeError.code = 'YOUTUBE_FORMAT_UNAVAILABLE';
    youtubeError.status = 422;
    youtubeError.message = 'Format audio video ini tidak tersedia.';
    return youtubeError;
  }

  youtubeError.code = 'YOUTUBE_REQUEST_FAILED';
  youtubeError.message = raw.split('\n').find(Boolean)?.slice(0, 300) || 'Gagal mengakses YouTube.';
  return youtubeError;
}

async function runYtdl(args, cookiesFile) {
  const baseArgs = [
    '--no-warnings',
    '--no-check-certificates',
    '--no-playlist',
    '--socket-timeout', '20',
    '--retries', '2',
    '--fragment-retries', '2',
    '--referer', 'https://www.youtube.com/',
    '--js-runtimes', 'node',
    '--extractor-args', `youtubepot-bgutilhttp:base_url=${YOUTUBE_POT_PROVIDER_URL}`,
  ];
  if (cookiesFile) baseArgs.push('--cookies', cookiesFile);

  const { stdout } = await execFileAsync(YTDLP, [...baseArgs, ...args], {
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

async function runYtdlWithClients(args, cookiesFile) {
  let lastError;
  const candidates = cookiesFile
    ? ['mweb', 'web_safari', 'web', 'default']
    : ['mweb', 'android_vr', 'web_safari', 'ios', 'android', 'default'];
  for (const client of candidates) {
    try {
      if (client === 'default') return await runYtdl(args, cookiesFile);
      return await runYtdl([
        ...args,
        '--extractor-args',
        `youtube:player_client=${client}`,
      ], cookiesFile);
    } catch (error) {
      lastError = error;
      if (isCookieError(errorText(error))) throw createYoutubeError(error, cookiesFile);
    }
  }

  throw createYoutubeError(lastError, cookiesFile);
}

export async function runYtCommand(args, cookiesFile) {
  return await runYtdlWithClients(args, cookiesFile);
}

export async function downloadYoutubeMp3({ url, speed = 1.0, amplify = 0, cookies }) {
  const videoId = getVideoId(url) || `video_${Date.now()}`;
  const runId = `${videoId}_${Date.now()}`;
  const tempBase = join(BACKEND_ROOT, `temp_${runId}`);
  const outputPath = join(BACKEND_ROOT, `output_${runId}.mp3`);

  const cookiesFile = prepareCookiesFile(cookies);

  const findTempFile = () => {
    const match = readdirSync(BACKEND_ROOT).find((f) => f.startsWith(`temp_${runId}.`));
    return match ? join(BACKEND_ROOT, match) : null;
  };

  try {
    const ytArgs = [
      '--print', 'title',
      '--no-simulate',
      cleanYoutubeUrl(url),
      '--output', `${tempBase}.%(ext)s`,
      '--format', 'bestaudio/best',
    ];
    if (!cookiesFile) {
      ytArgs.push('--downloader', 'aria2c', '--downloader-args', 'aria2c:-j 4 -x 4 -k 1M');
    }

    const stdout = String(await runYtCommand(ytArgs, cookiesFile));

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
  const cookiesFile = prepareCookiesFile(cookies);

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
    throw error;
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

  const cookiesFile = prepareCookiesFile(cookies);

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
