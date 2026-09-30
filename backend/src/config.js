import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const BACKEND_ROOT = join(__dirname, '..');

export const YTDLP = process.env.YTDLP_PATH ||
  join(BACKEND_ROOT, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

export const YOUTUBE_POT_PROVIDER_URL =
  process.env.YOUTUBE_POT_PROVIDER_URL || 'http://127.0.0.1:4416';

/**
 * Decode a base64 Netscape cookies.txt payload. Returns null when the value is
 * empty or clearly not a cookie jar (guards against malformed env values).
 */
function decodeCookieBase64(b64) {
  if (!b64 || typeof b64 !== 'string') return null;
  try {
    const decoded = Buffer.from(b64.trim(), 'base64').toString('utf8');
    return decoded.includes('\t') || decoded.includes('# Netscape') ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Collect every server-side cookie jar.
 *
 * Supported env vars (add as many as you like, in this order):
 *   YT_COOKIES_B64, YT_COOKIES_B64_2, YT_COOKIES_B64_3, ...
 *
 * Multiple jars let the retry logic rotate accounts when YouTube throws a bot
 * check, which is far more resilient than a single cookie.
 */
export function getYoutubeCookiesPool() {
  const pool = [];

  const push = (b64) => {
    const decoded = decodeCookieBase64(b64);
    if (decoded && !pool.includes(decoded)) pool.push(decoded);
  };

  push(process.env.YT_COOKIES_B64);
  for (let i = 2; i <= 10; i++) {
    push(process.env[`YT_COOKIES_B64_${i}`]);
  }

  return pool;
}

/**
 * Resolve the cookie pool for a request.
 *
 * Priority:
 *   1. Cookies explicitly sent by the client (single-entry override)
 *   2. Every server-side cookie jar from the environment
 */
export function resolveYoutubeCookies(requestCookies) {
  if (requestCookies && typeof requestCookies === 'string' && requestCookies.trim()) {
    return [requestCookies.trim()];
  }
  return getYoutubeCookiesPool();
}

export function isBotError(message) {
  return /sign in to confirm|not a bot|confirm you'?re not a bot|unusual traffic|captcha|confirm.*human|login required/i.test(message || '');
}

export function isCookieError(message) {
  return /cookies.*(invalid|expired)|account cookies|login cookies|cookie.*expired|authentication.*failed/i.test(message || '');
}

export function isFormatError(message) {
  return /no audio formats|requested format.*not available|format.*not found|doesn't contain any.*audio/i.test(message || '');
}

export function getVideoId(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function cleanYoutubeUrl(url) {
  const id = getVideoId(url);
  if (!id) return url;
  return `https://www.youtube.com/watch?v=${id}`;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
