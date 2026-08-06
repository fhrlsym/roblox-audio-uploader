import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const BACKEND_ROOT = join(__dirname, '..');

export const YTDLP = process.env.YTDLP_PATH ||
  join(BACKEND_ROOT, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

export const YOUTUBE_CLIENTS = ['android', 'ios', 'mweb', 'tvhtml5', 'web_safari', 'web', 'default'];

export function isBotError(message) {
  return /sign in to confirm|not a bot|confirm you'?re not a bot|unusual traffic|captcha|confirm.*human/i.test(message || '');
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
