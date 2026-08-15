import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { BACKEND_ROOT, YTDLP, formatDuration } from '../config.js';
import { runFFmpeg } from './ffmpeg.service.js';

const execFileAsync = promisify(execFile);

function isSoundCloudUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === 'soundcloud.com' || hostname.endsWith('.soundcloud.com') || hostname === 'on.soundcloud.com';
  } catch {
    return false;
  }
}

function sanitizeTitle(value) {
  return String(value || 'SoundCloud Audio')
    .replace(/[<>:"/\\|?*]/g, '')
    .trim()
    .slice(0, 80) || 'SoundCloud Audio';
}

async function runSoundCloudCommand(args) {
  const { stdout } = await execFileAsync(YTDLP, [
    '--no-warnings',
    '--no-check-certificates',
    '--no-playlist',
    '--socket-timeout', '20',
    '--retries', '2',
    ...args,
  ], {
    timeout: 120000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout;
}

export async function fetchSoundCloudInfo(url) {
  if (!isSoundCloudUrl(url)) throw new Error('URL SoundCloud tidak valid');

  const stdout = await runSoundCloudCommand(['--dump-single-json', url]);
  const data = JSON.parse(stdout);
  const duration = Number(data.duration) || 0;

  return {
    id: String(data.id || url),
    title: sanitizeTitle(data.title),
    durationString: data.duration_string || formatDuration(duration),
    duration,
    thumbnail: data.thumbnail || '',
    channel: data.uploader || data.artist || 'SoundCloud',
  };
}

export async function downloadSoundCloudMp3({ url }) {
  if (!isSoundCloudUrl(url)) throw new Error('URL SoundCloud tidak valid');

  const runId = `soundcloud_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tempBase = join(BACKEND_ROOT, `temp_${runId}`);
  const outputPath = join(BACKEND_ROOT, `output_${runId}.mp3`);

  const findTempFile = () => {
    const match = readdirSync(BACKEND_ROOT).find((file) => file.startsWith(`temp_${runId}.`));
    return match ? join(BACKEND_ROOT, match) : null;
  };

  try {
    const stdout = await runSoundCloudCommand([
      '--print', 'title',
      '--no-simulate',
      '--format', 'bestaudio/best',
      '--output', `${tempBase}.%(ext)s`,
      url,
    ]);
    const title = sanitizeTitle(stdout.trim());
    const tempPath = findTempFile();
    if (!tempPath) throw new Error('File audio SoundCloud tidak ditemukan setelah download');

    await runFFmpeg(tempPath, outputPath, 1, 0);
    if (existsSync(tempPath)) unlinkSync(tempPath);

    return {
      title,
      fileId: `output_${runId}`,
    };
  } catch (error) {
    const tempPath = findTempFile();
    for (const file of [tempPath, outputPath]) {
      if (file && existsSync(file)) {
        try { unlinkSync(file); } catch {}
      }
    }
    throw error;
  }
}
