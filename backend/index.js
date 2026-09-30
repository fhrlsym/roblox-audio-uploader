import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { BACKEND_ROOT, YTDLP } from './src/config.js';
import { installConsoleCapture, getLogs, clearLogs } from './src/logger.js';
import audioRoutes from './src/routes/audio.routes.js';
import robloxRoutes from './src/routes/roblox.routes.js';
import githubRoutes from './src/routes/github.routes.js';
import dumperRoutes from './src/routes/dumper.routes.js';

const app = express();

// Capture console output into an in-memory ring buffer for the Developer Panel.
installConsoleCapture();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', audioRoutes);
app.use('/api', robloxRoutes);
app.use('/api', githubRoutes);
app.use('/api', dumperRoutes);

// Log retrieval for the Developer Panel
app.get('/api/logs', (req, res) => {
  const since = Number(req.query.since) || 0;
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const level = typeof req.query.level === 'string' ? req.query.level : undefined;
  res.json({ logs: getLogs({ since, limit, level }), now: Date.now() });
});

app.delete('/api/logs', (req, res) => {
  clearLogs();
  res.json({ ok: true });
});

// Health & Version endpoints
process.env.STARTED_AT = process.env.STARTED_AT || new Date().toISOString();
app.get('/api/version', (req, res) => {
  res.json({
    commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || null,
    startedAt: process.env.STARTED_AT || null,
  });
});

// --- Rich health data (cached 60s, refreshed lazily) ---
const healthCache = { data: null, fetchedAt: 0 };
const HEALTH_TTL = 60 * 1000;

async function execVersion(cmd, args) {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: 8000 });
    return stdout.trim().split('\n')[0];
  } catch {
    return null;
  }
}

async function getDiskUsage() {
  const { statfs } = await import('fs/promises').catch(() => ({ statfs: null }));
  try {
    if (!statfs) {
      // Fallback: sum file sizes in backend root (approximation)
      const { readdirSync, statSync } = await import('fs');
      let total = 0;
      let count = 0;
      for (const f of readdirSync('.')) {
        try {
          const st = statSync(f);
          if (st.isFile()) { total += st.size; count++; }
        } catch { /* ignore */ }
      }
      return { type: 'approx', totalBytes: total, fileCount: count };
    }
    const fs = await statfs('.');
    const total = Number(fs.blocks) * Number(fs.bsize);
    const free = Number(fs.bfree) * Number(fs.bsize);
    return { type: 'statfs', totalBytes: total, freeBytes: free, usedBytes: total - free };
  } catch {
    return { type: 'unknown' };
  }
}

function countTempFiles() {
  let temp = 0, output = 0, upload = 0;
  try {
    temp = readdirSync('.').filter((f) => f.startsWith('temp_')).length;
    output = readdirSync('.').filter((f) => f.startsWith('output_')).length;
  } catch { /* ignore */ }
  try {
    upload = readdirSync('uploads').length;
  } catch { /* ignore */ }
  return { temp, output, upload };
}

function getCacheStats() {
  try {
    const { videoInfoCache } = globalThis.__s2cache || {};
    if (videoInfoCache) {
      return {
        size: videoInfoCache.size,
        max: 200,
      };
    }
  } catch { /* ignore */ }
  return null;
}

app.get('/api/health', async (req, res) => {
  const now = Date.now();
  if (healthCache.data && now - healthCache.fetchedAt < HEALTH_TTL) {
    return res.json({ ...healthCache.data, cached: true, ageSeconds: Math.floor((now - healthCache.fetchedAt) / 1000) });
  }

  const [ytdlpVersion, ffmpegVersion, disk, tempFiles, mem] = await Promise.all([
    execVersion(YTDLP, ['--version']),
    execVersion('ffmpeg', ['-version']),
    getDiskUsage(),
    Promise.resolve(countTempFiles()),
    Promise.resolve(process.memoryUsage()),
  ]);

  const queue = globalThis.__s2uploadQueue ? {
    pending: globalThis.__s2uploadQueue.pending,
    active: globalThis.__s2uploadQueue.active,
  } : null;

  const data = {
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: process.env.STARTED_AT,
    timestamp: new Date().toISOString(),
    versions: {
      node: process.version,
      ytdlp: ytdlpVersion,
      ffmpeg: ffmpegVersion,
    },
    resources: {
      disk,
      tempFiles,
      memory: {
        rssMB: Math.round(mem.rss / 1024 / 1024),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      },
    },
    uploadQueue: queue,
    flags: {
      youtubeCookies: Boolean(process.env.YT_COOKIES_B64),
      potProvider: Boolean(process.env.YOUTUBE_POT_PROVIDER_URL),
    },
  };

  healthCache.data = data;
  healthCache.fetchedAt = now;
  res.json({ ...data, cached: false });
});

// Fallback JSON for unmatched /api routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Endpoint '${req.originalUrl}' tidak ditemukan pada backend.` });
});

// Express global JSON error handler
app.use((err, req, res, next) => {
  console.error('[Express Error]', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

// Periodic temp file cleanup
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
  check(BACKEND_ROOT, 'output_');
  check(BACKEND_ROOT, 'temp_');
  check(BACKEND_ROOT, 'spoof_');
  check(BACKEND_ROOT, 'cookies_');
  check(join(BACKEND_ROOT, 'uploads'), '');
}
setInterval(sweepOldFiles, 10 * 60 * 1000);

// Keep-alive self-ping to prevent Railway free plan cold start
const KEEP_ALIVE_URL = process.env.RAILWAY_PUBLIC_URL || process.env.BACKEND_URL;
if (KEEP_ALIVE_URL) {
  const PING_INTERVAL = 10 * 60 * 1000; // every 10 minutes
  setInterval(async () => {
    try {
      await fetch(`${KEEP_ALIVE_URL}/api/health`);
      console.log('[KeepAlive] Self-ping OK');
    } catch {
      console.log('[KeepAlive] Self-ping failed (non-critical)');
    }
  }, PING_INTERVAL);
  console.log(`[KeepAlive] Active → pinging ${KEEP_ALIVE_URL}/api/health every 10min`);
}

// Graceful shutdown: cleanup temp files on SIGTERM/SIGINT
function gracefulShutdown(signal) {
  console.log(`[${signal}] received, cleaning up...`);
  try {
    for (const prefix of ['spoof_', 'output_', 'temp_', 'cookies_']) {
      for (const f of readdirSync(BACKEND_ROOT)) {
        if (f.startsWith(prefix)) {
          try { unlinkSync(join(BACKEND_ROOT, f)); } catch {}
        }
      }
    }
  } catch {}
  console.log('[Shutdown] Cleanup done, exiting.');
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
