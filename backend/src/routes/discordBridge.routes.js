import { Router } from 'express';
import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { BACKEND_ROOT } from '../config.js';
import { discordBridge } from '../services/discordBridge.service.js';

const router = Router();
const PENDING_TTL_MS = 10 * 60 * 1000;

// In-memory store permintaan yang menunggu file dari Discord.
// key = assetId, value = { assetId, createdAt, status, file }
const pendingRequests = new Map();
const fileCache = new Map(); // path -> { receivedAt }

// ============================================================
// Status koneksi bridge bot
// ============================================================
router.get('/discord-bridge/status', (req, res) => {
  res.json({ ...discordBridge.getStatus(), ready: discordBridge.ready });
});

// ============================================================
// Submit: user memasukkan asset id, web menunggu file
// ============================================================
router.post('/discord-bridge/submit', async (req, res) => {
  const { assetId } = req.body;
  const cleanId = String(assetId || '').replace(/\D/g, '');
  if (!cleanId) return res.status(400).json({ error: 'assetId wajib diisi' });

  const existing = pendingRequests.get(cleanId);
  if (existing && (Date.now() - existing.createdAt) < PENDING_TTL_MS && existing.status === 'waiting' && !existing.awaitingCommand) {
    return res.json(existing);
  }

  const record = {
    assetId: cleanId,
    createdAt: Date.now(),
    status: 'waiting',
    awaitingCommand: true,
    commandSent: false,
    file: null,
    message: 'Mengirim perintah ke Discord...',
  };
  pendingRequests.set(cleanId, record);

  // Otomatis kirim perintah /download ke channel Discord
  try {
    const sent = await discordBridge.sendCommand(cleanId);
    record.commandSent = sent.success;
    record.commandError = sent.success ? null : sent.error;
    record.awaitingCommand = false;
    record.message = sent.success
      ? 'Perintah dikirim ke Discord. Menunggu bot mengirim file...'
      : `Gagal mengirim: ${sent.error}`;
  } catch (err) {
    record.awaitingCommand = false;
    record.commandError = err.message || 'Gagal mengirim perintah';
    record.message = `Gagal mengirim perintah: ${record.commandError}`;
  }

  res.json(record);
});

// ============================================================
// Polling status
// ============================================================
router.get('/discord-bridge/status/:assetId', (req, res) => {
  const cleanId = String(req.params.assetId || '').replace(/\D/g, '');
  const record = pendingRequests.get(cleanId);

  if (!record) {
    return res.json({ assetId: cleanId, status: 'unknown', message: 'Belum ada permintaan untuk asset ini.' });
  }

  // File siap di filesystem
  if (record.file && record.status === 'ready') {
    return res.json(record);
  }

  // Cek file di uploads yang cocok
  const matched = findFileForAsset(cleanId);
  if (matched) {
    record.status = 'ready';
    record.file = matched;
    res.json(record);
  } else {
    res.json(record);
  }
});

// ============================================================
// Download file hasil
// ============================================================
router.get('/discord-bridge/download/:assetId', (req, res) => {
  const cleanId = String(req.params.assetId || '').replace(/\D/g, '');
  const record = pendingRequests.get(cleanId);
  if (!record || !record.file || !existsSync(record.file.filePath)) {
    return res.status(404).json({ error: 'File belum tersedia.' });
  }
  res.download(record.file.filePath, record.file.fileName);
});

// ============================================================
// Hapus permintaan
// ============================================================
router.delete('/discord-bridge/:assetId', (req, res) => {
  const cleanId = String(req.params.assetId || '').replace(/\D/g, '');
  pendingRequests.delete(cleanId);
  res.json({ success: true });
});

// ============================================================
// Utility: cari file yang cocok dengan asset id
// ============================================================
function findFileForAsset(assetId) {
  const uploadsDir = join(BACKEND_ROOT, 'uploads');
  if (!existsSync(uploadsDir)) return null;

  let entries;
  try { entries = readdirSync(uploadsDir); } catch { return null; }

  // Cari file yang namanya mengandung assetId (cocok untuk file bernama "ID.ogg")
  for (const f of entries) {
    if (f.includes(assetId)) {
      const p = join(uploadsDir, f);
      const st = statSync(p);
      return { fileName: f, filePath: p, size: st.size, receivedAt: st.mtimeMs };
    }
  }
  return null;
}

// Bersihkan pending yang kedaluwarsa
setInterval(() => {
  const now = Date.now();
  for (const [id, rec] of pendingRequests) {
    if (now - rec.createdAt > PENDING_TTL_MS) pendingRequests.delete(id);
  }
}, 60 * 1000);

export default router;