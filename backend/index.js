import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { BACKEND_ROOT } from './src/config.js';
import audioRoutes from './src/routes/audio.routes.js';
import robloxRoutes from './src/routes/roblox.routes.js';
import githubRoutes from './src/routes/github.routes.js';
import dumperRoutes from './src/routes/dumper.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', audioRoutes);
app.use('/api', robloxRoutes);
app.use('/api', githubRoutes);
app.use('/api', dumperRoutes);

// Health & Version endpoints
process.env.STARTED_AT = process.env.STARTED_AT || new Date().toISOString();
app.get('/api/version', (req, res) => {
  res.json({
    commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || null,
    startedAt: process.env.STARTED_AT || null,
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
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
