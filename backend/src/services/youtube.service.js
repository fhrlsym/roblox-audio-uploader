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
import { logger } from '../logger.js';

const videoInfoCache = new LRUCache({
  max: 200,
  ttl: 1000 * 60 * 60 * 24, // 24 hours
});

// Expose cache for /api/health
globalThis.__s2cache = { videoInfoCache };

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

/**
 * Write every cookie jar in the pool to a file.
 * Returns an array of file paths (possibly empty).
 */
function prepareCookiePool(pool) {
  if (!Array.isArray(pool)) return [];
  return pool.map((c) => prepareCookiesFile(c)).filter(Boolean);
}

function cleanupCookiePool(files) {
  for (const f of files || []) {
    if (f && existsSync(f)) {
      try {
        unlinkSync(f);
      } catch {
        // ignore
      }
    }
  }
}

function errorText(error) {
  return [error?.stderr, error?.stdout, error?.message].filter(Boolean).join('\n');
}

function redactSensitiveText(value) {
  return String(value || '').replace(/(https?:\/\/)[^\s:@/]+:[^\s@/]+@/gi, '$1[credentials]@');
}

function createYoutubeError(error, hadCookies) {
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
    if (hadCookies) {
      youtubeError.code = 'YOUTUBE_ACCESS_BLOCKED';
      youtubeError.status = 403;
      youtubeError.message = 'YouTube masih memblokir akses (bot check) setelah beberapa kali percobaan. Coba lagi beberapa saat, atau perbarui cookies YouTube.';
    } else {
      youtubeError.code = 'YOUTUBE_AUTH_REQUIRED';
      youtubeError.status = 401;
      youtubeError.message = 'YouTube meminta verifikasi (bot check). Tambahkan cookies YouTube lalu coba lagi.';
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

// Player clients to rotate through. Order is shuffled per attempt so we don't
// repeat the same (already block-listed) client first every single time.
const CLIENTS_WITH_COOKIES = ['web', 'mweb', 'web_safari', 'tv', 'web_embedded', 'default'];
const CLIENTS_NO_COOKIES = ['tv', 'web_embedded', 'mweb', 'android_vr', 'web_safari', 'ios', 'android', 'default'];

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Each "wave" runs the given client list in random order. Multiple waves plus a
// short backoff give transient YouTube bot-checks a chance to clear.
const MAX_WAVES = 3;
// Hard ceiling for the whole retry loop so a request can't hang for minutes.
const RETRY_DEADLINE_MS = 90 * 1000;

/**
 * Try a command across every combination of cookie jar x player client.
 *
 * - `cookieFiles` is a pool of prepared cookies.txt paths (may be empty).
 * - On a bot check we rotate to the next cookie jar and player client.
 * - A jar rejected as invalid (cookie error) is dropped for the rest of the run.
 * - The last wave also tries with no cookies as a final fallback.
 */
async function withRetry(args, cookieFiles) {
  const pool = Array.isArray(cookieFiles) ? cookieFiles.filter(Boolean) : [];
  let lastError;
  let attempts = 0;
  const startedAt = Date.now();

  // Track jars that YouTube explicitly rejected so we don't keep retrying them.
  const deadJars = new Set();

  for (let wave = 0; wave < MAX_WAVES; wave++) {
    // Scenario 0: with cookies (rotated per wave). Scenario 1 (last wave only):
    // no cookies, as a last-ditch attempt.
    const scenarios = [];
    const livePool = pool.filter((f) => !deadJars.has(f));
    if (livePool.length > 0) scenarios.push({ jars: shuffle(livePool), label: 'cookies' });
    if (wave === MAX_WAVES - 1) scenarios.push({ jars: [null], label: 'no-cookies' });
    if (scenarios.length === 0) scenarios.push({ jars: [null], label: 'no-cookies' });

    for (const scenario of scenarios) {
      for (const jar of scenario.jars) {
        const jarLabel = jar ? `jar:${pool.indexOf(jar) + 1}` : 'no-cookies';
        const clients = shuffle(jar ? CLIENTS_WITH_COOKIES : CLIENTS_NO_COOKIES);

        for (const client of clients) {
          if (Date.now() - startedAt > RETRY_DEADLINE_MS) {
            const err = createYoutubeError(lastError, pool.length > 0);
            err.attempts = attempts;
            err.timedOut = true;
            throw err;
          }

          attempts++;
          try {
            logger.info(`[yt] attempt #${attempts} client=${client} ${jarLabel} (wave ${wave + 1})`);
            if (client === 'default') {
              return await runYtdl(args, jar);
            }
            return await runYtdl(
              [...args, '--extractor-args', `youtube:player_client=${client}`],
              jar,
            );
          } catch (error) {
            lastError = error;
            const raw = errorText(error);
            const short = raw.split('\n').find((l) => /ERROR|error:/i.test(l)) || raw.split('\n').find(Boolean) || '';
            logger.warn(`[yt] attempt #${attempts} client=${client} ${jarLabel} failed: ${short.slice(0, 260)}`);

            // A jar explicitly rejected as invalid is dead — drop it and move on.
            if (jar && isCookieError(raw)) {
              deadJars.add(jar);
              logger.warn(`[yt] ${jarLabel} rejected as invalid — dropping this jar`);
              break;
            }

            // Bot-check / rate-limit: back off briefly before the next attempt.
            if (isBotError(raw)) {
              await sleep(600 + wave * 900 + Math.floor(Math.random() * 400));
            }
          }
        }
      }
    }
  }

  const err = createYoutubeError(lastError, pool.length > 0);
  err.attempts = attempts;
  throw err;
}

export async function runYtCommand(args, cookieFiles) {
  return await withRetry(args, cookieFiles);
}

export async function downloadYoutubeMp3({ url, speed = 1.0, amplify = 0, cookies }) {
  const videoId = getVideoId(url) || `video_${Date.now()}`;
  const runId = `${videoId}_${Date.now()}`;
  const tempBase = join(BACKEND_ROOT, `temp_${runId}`);
  const outputPath = join(BACKEND_ROOT, `output_${runId}.mp3`);

  const cookieFiles = prepareCookiePool(cookies);

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
    if (cookieFiles.length === 0) {
      ytArgs.push('--downloader', 'aria2c', '--downloader-args', 'aria2c:-j 4 -x 4 -k 1M');
    }

    logger.info(`[yt] download start video=${videoId} cookieJars=${cookieFiles.length} speed=${speed} amplify=${amplify}`);

    let stdout;
    try {
      stdout = String(await runYtCommand(ytArgs, cookieFiles));
    } catch (error) {
      logger.error(`[yt] download failed video=${videoId} code=${error.code || 'n/a'} attempts=${error.attempts || '?'}: ${error.message}`);
      throw error;
    }

    const title = stdout.trim().replace(/[<>:"/\\|?*]/g, '').substring(0, 50) || `audio_${videoId}`;

    let tempAudioPath = findTempFile();
    if (!tempAudioPath) {
      await sleep(2000);
      tempAudioPath = findTempFile();
    }
    if (!tempAudioPath) {
      logger.error(`[yt] downloaded file not found for runId=${runId}`);
      throw new Error('Audio temp file not found after download');
    }

    let finalAudioPath = tempAudioPath;

    if (speed !== 1.0 || amplify !== 0) {
      if (existsSync(outputPath)) unlinkSync(outputPath);
      logger.info(`[yt] ffmpeg tune start speed=${speed} amplify=${amplify}`);
      try {
        await runFFmpeg(tempAudioPath, outputPath, speed, amplify);
      } catch (error) {
        logger.error(`[yt] ffmpeg tune failed: ${error.message}`);
        throw error;
      }
      if (existsSync(tempAudioPath)) unlinkSync(tempAudioPath);
      finalAudioPath = outputPath;
    }

    logger.info(`[yt] download ok video=${videoId} title="${title}" fileId=${finalAudioPath === tempAudioPath ? `temp_${runId}` : `output_${runId}`}`);

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
    cleanupCookiePool(cookieFiles);
  }
}

export async function searchYoutube(query, cookies) {
  const cookieFiles = prepareCookiePool(cookies);

  try {
    const stdout = await runYtCommand([
      '--print',
      '%(id)s\n%(title)s\n%(duration_string)s\n%(thumbnail)s\n%(channel)s\n%(duration)s',
      `ytsearch1:${query}`,
    ], cookieFiles);

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
    cleanupCookiePool(cookieFiles);
  }
}

export async function fetchYoutubeVideoInfo(url, cookies) {
  const videoId = getVideoId(url);
  const cacheKey = `${videoId || url}_${Boolean(cookies)}`;
  if (videoInfoCache.has(cacheKey)) {
    return videoInfoCache.get(cacheKey);
  }

  const cookieFiles = prepareCookiePool(cookies);

  try {
    const stdout = await runYtCommand([
      '--print',
      '%(title)s\n%(duration_string)s\n%(duration)s\n%(thumbnail)s\n%(channel)s\n%(id)s',
      '--ignore-no-formats-error',
      cleanYoutubeUrl(url),
    ], cookieFiles);

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
    cleanupCookiePool(cookieFiles);
  }
}
