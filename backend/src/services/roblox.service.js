import fetch from 'node-fetch';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { sleep, BACKEND_ROOT } from '../config.js';

export function cleanSongTitle(rawTitle) {
  if (!rawTitle) return '';
  let name = String(rawTitle);
  name = name.replace(/\.(mp3|ogg|wav|m4a|flac|aac)$/i, '');
  name = name.replace(/_\d+(?:\.\d+)?x(?:_[-+]?\d+dB)?/gi, '');
  name = name.replace(/_[-+]?\d+dB/gi, '');
  name = name.replace(/_\d+$/g, '');
  name = name.replace(/[\(\[](?:Official\s+)?(?:Lyric|Music|HD|4K|Full)?\s*(?:Video|Audio|Lyric|Lyrics|Track|Visualizer|Stream)?[\)\]]/gi, '');
  name = name.replace(/[\s\-_]+/g, ' ').trim();
  return name || String(rawTitle);
}

export async function uploadToRoblox(filePath, { assetType = 'Audio', displayName = 'Untitled', description = '', creatorType = 'user', creatorId, apiKey }) {
  const creator = creatorType === 'group' ? { groupId: creatorId } : { userId: creatorId };

  const safeName = cleanSongTitle(displayName).slice(0, 50).trim() || 'Untitled';

  const fileType = String(assetType || 'Audio');
  const typeLower = fileType.toLowerCase();
  let fileExt = 'rbx';
  let fileContentType = 'application/octet-stream';
  if (typeLower === 'audio' || typeLower === 'sound') {
    fileExt = 'mp3';
    fileContentType = 'audio/mpeg';
  } else if (typeLower === 'animation') {
    fileExt = 'rbx';
    fileContentType = 'model/x-rbxm';
  } else if (typeLower === 'model' || typeLower === 'hat') {
    fileExt = 'rbxm';
    fileContentType = 'model/x-rbxm';
  } else if (typeLower === 'decal' || typeLower === 'image' || typeLower === 'texture' || typeLower === 'tshirt') {
    fileExt = 'png';
    fileContentType = 'image/png';
  } else if (typeLower === 'mesh' || typeLower === 'meshpart') {
    fileExt = 'mesh';
    fileContentType = 'model/x-file-mesh-data';
  } else if (typeLower === 'video') {
    fileExt = 'mp4';
    fileContentType = 'video/mp4';
  }

  const form = new FormData();
  form.append('request', JSON.stringify({
    assetType: fileType,
    displayName: safeName,
    description,
    creationContext: {
      assetPrivacy: 'default',
      creator,
      expectedPrice: 0,
    },
  }));
  form.append('fileContent', createReadStream(filePath), {
    filename: `${safeName}.${fileExt}`,
    contentType: fileContentType,
  });

  const response = await fetch('https://apis.roblox.com/assets/v1/assets', {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: form,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const rob = (Array.isArray(data.errors) && data.errors[0]) ? data.errors[0] : null;
    const message =
      rob?.userFacingMessage ||
      rob?.message ||
      data.userFacingMessage ||
      data.message ||
      data.code ||
      `Upload failed (${response.status})`;
    console.error('[Roblox Upload Error]', response.status, JSON.stringify(data));
    const err = new Error(message);
    err.details = data;
    err.status = response.status;
    throw err;
  }

  const pathMatch = (data.path || '').match(/operations\/(.+)/);
  if (!pathMatch) {
    const err = new Error('No operation ID returned');
    err.details = data;
    err.status = 500;
    throw err;
  }

  return pathMatch[1];
}

export async function checkOperationStatus(operationId, apiKey) {
  const opRes = await fetch(
    `https://apis.roblox.com/assets/v1/operations/${operationId}`,
    { headers: { 'x-api-key': apiKey } }
  );
  const data = await opRes.json().catch(() => ({}));

  if (!data.done) {
    return { done: false };
  }

  if (data.error) {
    const raw = typeof data.error === 'string' ? data.error : (data.error.message || data.error.status || JSON.stringify(data.error));
    const rawLower = (raw + ' ' + (data.error.status || '')).toLowerCase();
    const status = /reject|copyright|flag|moderat|denied|infring|disallowed|invalid/i.test(rawLower) ? 'Copyright' : 'Failed';
    return {
      done: true,
      status,
      error: status === 'Copyright'
        ? 'Ditolak moderasi Roblox (kemungkinan hak cipta).'
        : `Upload ditolak Roblox: ${raw}`,
    };
  }

  const resp = data.response || {};
  const pathText = resp.path || data.path || '';
  const assetId = resp.assetId
    || (pathText.match(/assets\/(\d+)/) || [])[1]
    || null;

  if (!assetId) {
    return { done: true, error: 'Upload gagal tanpa ID aset. Kemungkinan ditolak moderasi Roblox.', details: data };
  }

  let status = 'Pending';
  const moderation = resp.moderationResult;
  if (moderation) {
    const m = moderation.moderationState;
    if (m === 'MODERATION_STATE_APPROVED' || m === 'Approved') status = 'Active';
    else if (m === 'MODERATION_STATE_REJECTED' || m === 'Rejected') status = 'Copyright';
    else if (m && m.includes('REJECTED')) status = 'Copyright';
  }

  return { done: true, assetId, status };
}

export async function checkAssetStatus(assetId, apiKey) {
  const response = await fetch(
    `https://apis.roblox.com/assets/v1/assets/${assetId}`,
    { headers: { 'x-api-key': apiKey } }
  );
  const data = await response.json().catch(() => ({}));

  let status = 'Pending';
  const moderation = data.moderationResult && data.moderationResult.moderationState;
  if (moderation) {
    if (moderation === 'MODERATION_STATE_APPROVED' || moderation === 'Approved' || moderation === 'Active') {
      status = 'Active';
    } else if (moderation === 'MODERATION_STATE_REJECTED' || moderation === 'Rejected') {
      status = 'Copyright';
    }
  } else if (data.state) {
    if (data.state === 'Active') status = 'Active';
    else if (data.state === 'Rejected') status = 'Copyright';
    else if (data.state === 'Pending') status = 'Pending';
    else status = 'Failed';
  }

  return { status, ...data };
}

export async function fetchWithRetry(url, tries = 3, options = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, options);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (data.error && data.error.message) throw new Error(data.error.message);
        if (data.errors && data.errors[0] && data.errors[0].message) throw new Error(data.errors[0].message);
        if (data.message) throw new Error(data.message);
        throw new Error(`Roblox API error (${r.status})`);
      }
      return data;
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(500 * (i + 1));
    }
  }
  return {};
}

export const ASSET_TYPE_MAP = {
  '1': 'Image',
  '3': 'Audio',
  '4': 'Mesh',
  '8': 'Hat',
  '11': 'Decal',
  '12': 'Video',
  '19': 'Model',
  '24': 'Animation',
  '31': 'MeshPart',
  '61': 'Texture',
};

// ============================================================
// SPOOFER: Unduh byte asli via API Blokmarket (batch async)
// Ala: POST /api/download/batch/async -> task_id
//      GET  /api/task/{task_id}/status   -> poll sampai completed
//      GET  /api/files/download/<file>   -> ambil file (format bebas)
// Tidak perlu cookie/auth — cukup Origin/Referer Blokmarket.
// ============================================================
const SPOOFER_API_BASE = (process.env.SPOOFER_API_URL || 'https://spoofer.blokmarket.store').replace(/\/+$/, '');

function spoofHeaders() {
  return {
    Origin: 'https://spoofer.blokmarket.store',
    Referer: 'https://blokmarket.store/',
    'User-Agent': 'Mozilla/5.0',
  };
}

// Unduh byte asli asset (format apa pun: Audio/Animation/Decal/Image/dll) via API.
export async function downloadOriginalAssetAPI(assetId) {
  const cleanId = String(assetId).replace(/\D/g, '');
  if (!cleanId) throw new Error('Asset ID Roblox tidak valid');

  // 1) Submit batch async
  const submitRes = await fetch(`${SPOOFER_API_BASE}/api/download/batch/async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...spoofHeaders() },
    body: JSON.stringify({
      assets: [{ id: Number(cleanId), custom_name: `Asset_${cleanId}` }],
      is_free: true,
    }),
  });
  const submit = await submitRes.json().catch(() => ({}));
  const taskId = submit.task_id;
  if (!submitRes.ok || !taskId) {
    throw new Error(`Gagal memulai batch download (${submitRes.status}): ${submit.error || submit.message || 'tidak ada task_id'}`);
  }

  // 2) Poll status sampai completed
  const deadline = Date.now() + 5 * 60 * 1000;
  let taskData = null;
  while (Date.now() < deadline) {
    await sleep(2000);
    const statusRes = await fetch(`${SPOOFER_API_BASE}/api/task/${taskId}/status`, { headers: spoofHeaders() });
    if (!statusRes.ok) continue;
    taskData = await statusRes.json().catch(() => ({}));
    if (taskData.status === 'completed') break;
    if (taskData.status === 'failed' || taskData.status === 'error') {
      throw new Error(taskData.error || `Task download gagal (${taskData.status})`);
    }
  }
  if (!taskData || taskData.status !== 'completed') {
    throw new Error('Task download melewati batas waktu (5 menit).');
  }

  const result = (Array.isArray(taskData.results) && taskData.results[0]) || {};
  const downloadUrl = result.download_url;
  if (!downloadUrl) throw new Error('Tidak ada download_url pada hasil task.');

  // 3) Unduh file (format sesuai aset asli, tidak wajib OGG)
  // download_url bisa berupa: URL penuh, path "/api/files/download/xxx", atau nama file.
  const rawPath = String(downloadUrl).replace(/^\/+/, '');
  let fileUrl;
  if (/^https?:\/\//i.test(downloadUrl)) {
    fileUrl = downloadUrl;
  } else if (rawPath.startsWith('api/files/download/')) {
    fileUrl = `${SPOOFER_API_BASE}/${rawPath}`;
  } else {
    fileUrl = `${SPOOFER_API_BASE}/api/files/download/${encodeURIComponent(rawPath)}`;
  }
  const fileRes = await fetch(fileUrl, { headers: spoofHeaders() });
  if (!fileRes.ok) throw new Error(`Gagal mengunduh file (${fileRes.status})`);
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  if (!buffer.length) throw new Error('File hasil download kosong.');

  return { buffer, fileName: rawPath.split('/').pop() || `Asset_${cleanId}` };
}

// Wrapper kompat: tulis hasil API ke outputPath.
export async function downloadOriginalAsset(outputPath, assetId, cookie, assetType) {
  const { buffer } = await downloadOriginalAssetAPI(assetId);
  writeFileSync(outputPath, buffer);
  return false;
}

export async function detectAsset(assetId) {
  const cleanId = String(assetId).replace(/\D/g, '');
  if (!cleanId) return { assetId: null };
  const eco = await fetch(`https://economy.roblox.com/v2/assets/${cleanId}/details`);
  const ecoData = await eco.json().catch(() => ({}));
  const name = ecoData.Name || `Asset_${cleanId}`;
  const typeId = String(ecoData.AssetTypeId || '');
  const assetType = ASSET_TYPE_MAP[typeId] || null;
  return { assetId: cleanId, name, assetType };
}

const SPOOF_FILE_EXT = {
  Audio: 'mp3',
  Image: 'png',
  Decal: 'png',
  Texture: 'png',
  Animation: 'rbx',
  Model: 'rbxm',
  Hat: 'rbxm',
  Mesh: 'mesh',
  MeshPart: 'mesh',
  Video: 'mp4',
};

// ============================================================
// SPOOFER TWO-PHASE (job cache):
//  Fase 1 — download original bytes (Blokmarket) & tangkap metadata,
//           simpan sementara per job untuk terminal progress.
//  Fase 2 — upload file yang sudah diunduh ke Roblox, balikin ID baru.
// ============================================================
const spoofJobs = globalThis.__spoofJobs || (globalThis.__spoofJobs = new Map());
let spoofJobSeq = 0;

// Periodic cleanup for stale spoofJobs (> 2 hours) to prevent Node.js RAM memory leaks
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, job] of spoofJobs.entries()) {
    if (job.createdAt && job.createdAt < cutoff) {
      if (job.items) {
        for (const item of job.items) {
          item.bytes = null;
        }
      }
      spoofJobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

function sanitizeAssetId(value) {
  return String(value == null ? '' : value).replace(/\D/g, '');
}

function spoofJobPublic(job) {
  return {
    jobId: job.id,
    status: job.status,
    error: job.error || null,
    logs: job.logs || [],
    items: job.items.map((it) => ({
      key: it.key,
      originalAssetId: it.originalAssetId,
      name: it.name,
      assetType: it.assetType,
      fileName: it.fileName,
      status: it.status,
      error: it.error || null,
      newAssetId: it.newAssetId || null,
      uploadStatus: it.uploadStatus || null,
      uploadError: it.uploadError || null,
    })),
  };
}

function pushLog(job, message) {
  job.logs = job.logs || [];
  job.logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
  if (job.logs.length > 200) job.logs = job.logs.slice(-200);
}

// Fase 1: buat job, unduh semua byte asli (sementara disimpan di memory).
export function startSpoofDownload(assetIds) {
  const jobId = `sjob_${Date.now()}_${++spoofJobSeq}`;
  const job = {
    id: jobId,
    createdAt: Date.now(),
    status: 'running', // running | completed | partially | failed
    error: null,
    logs: [],
    items: [],
  };

  const seen = new Set();
  for (const raw of assetIds || []) {
    const originalAssetId = sanitizeAssetId(raw);
    if (!originalAssetId || seen.has(originalAssetId)) continue;
    seen.add(originalAssetId);
    job.items.push({
      key: `item_${originalAssetId}`,
      originalAssetId,
      name: null,
      assetType: null,
      fileName: null,
      bytes: null,
      status: 'queued', // queued -> downloading -> downloaded | failed
      error: null,
      newAssetId: null,
      uploadStatus: null,
      uploadError: null,
    });
  }

  if (job.items.length === 0) {
    job.status = 'failed';
    job.error = 'Tidak ada Asset ID valid untuk diproses.';
    spoofJobs.set(jobId, job);
    return job;
  }

  spoofJobs.set(jobId, job);
  pushLog(job, `Job dimulai: ${job.items.length} asset.`);
  runDownloadPhase(job).catch((e) => {
    job.status = 'failed';
    job.error = (e && e.message) || String(e);
    pushLog(job, `Job gagal: ${job.error}`);
  });
  return job;
}

async function runDownloadPhase(job) {
  const CONCURRENCY = 3;
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < job.items.length) {
      const item = job.items[nextIndex++];
      item.status = 'downloading';
      pushLog(job, `[${item.originalAssetId}] Mengunduh file asli...`);

      let detected = null;
      try {
        detected = await detectAsset(item.originalAssetId);
      } catch {
        // biarkan null
      }

      try {
        const { buffer, fileName } = await downloadOriginalAssetAPI(item.originalAssetId);
        item.bytes = buffer;
        item.fileName = fileName || `Asset_${item.originalAssetId}`;
        item.name = detected?.name || `Asset_${item.originalAssetId}`;
        item.assetType = detected?.assetType || item.assetType || 'Audio';
        item.status = 'downloaded';
        pushLog(job, `[${item.originalAssetId}] Didownload ${(buffer.length / 1024).toFixed(1)} KB -> ${item.fileName}`);
      } catch (e) {
        item.status = 'failed';
        item.error = (e && e.message) || 'Gagal mengunduh';
        pushLog(job, `[${item.originalAssetId}] GAGAL unduh: ${item.error}`);
      }
      // jeda ringan antar download
      await sleep(400);
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(CONCURRENCY, job.items.length)) }, worker)
  );

  const ok = job.items.filter((i) => i.status === 'downloaded').length;
  const failed = job.items.length - ok;
  pushLog(job, `Download selesai: ${ok} sukses, ${failed} gagal.`);
  job.status = ok > 0 ? 'completed' : 'failed';
  if (job.status === 'failed' && ok === 0) job.error = 'Semua asset gagal diunduh.';
}

export function getSpoofJob(jobId) {
  if (!jobId) return null;
  const cleanId = String(jobId).trim();
  return spoofJobs.get(cleanId) || Array.from(spoofJobs.values()).find((j) => j.id === cleanId) || null;
}

export function getSpoofJobPublic(jobId) {
  const job = getSpoofJob(jobId);
  return job ? spoofJobPublic(job) : null;
}

// Fase 2: upload item yang sudah diund ke Roblox (bisa dipilih per item).
export async function runSpoofUpload({ jobId, creatorType = 'user', creatorId, apiKey, keys = null }) {
  const job = spoofJobs.get(jobId);
  if (!job) throw new Error('Job spoof tidak ditemukan (mungkin sudah kadaluarsa).');

  const targets = job.items.filter(
    (it) =>
      it.status === 'downloaded' &&
      (keys == null || (Array.isArray(keys) && keys.includes(it.key)))
  );

  if (targets.length === 0) {
    throw new Error('Tidak ada file siap upload dari job ini.');
  }
  if (!creatorId || !apiKey) {
    throw new Error('creatorId dan apiKey wajib diisi.');
  }

  pushLog(job, `Mulai upload ${targets.length} asset ke Roblox...`);

  const CONCURRENCY = 2;
  let nextIndex = 0;
  const items = targets;

  const worker = async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex++];
      item.uploadStatus = 'uploading';
      pushLog(job, `Upload [${item.originalAssetId}] ke Roblox...`);

      const ext = SPOOF_FILE_EXT[item.assetType] || 'bin';
      const tempFile = join(BACKEND_ROOT, `spoof_${job.id}_${item.originalAssetId}.${ext}`);
      try {
        writeFileSync(tempFile, item.bytes);

        const operationId = await uploadToRoblox(tempFile, {
          assetType: item.assetType,
          displayName: item.name || `Spoofed_${item.originalAssetId}`,
          description: `Awaited from ${item.originalAssetId} (${job.id})`,
          creatorType,
          creatorId,
          apiKey,
        });

        let newId = null;
        for (let i = 0; i < 30; i++) {
          await sleep(2000);
          const opData = await checkOperationStatus(operationId, apiKey);
          if (opData.done) {
            newId = opData.assetId || null;
            break;
          }
        }

        if (newId) {
          item.newAssetId = String(newId);
          item.uploadStatus = 'done';
          pushLog(job, `[${item.originalAssetId}] Upload sukses -> ID ${newId}`);
        } else {
          item.uploadStatus = 'failed';
          item.uploadError = 'Upload selesai tapi tak ada ID baru (kemungkinan ditolak moderasi).';
          pushLog(job, `[${item.originalAssetId}] ${item.uploadError}`);
        }
      } catch (e) {
        item.uploadStatus = 'failed';
        item.uploadError = (e && e.message) || String(e);
        pushLog(job, `[${item.originalAssetId}] Gagal upload: ${item.uploadError}`);
      } finally {
        if (existsSync(tempFile)) {
          try { unlinkSync(tempFile); } catch {}
        }
      }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(CONCURRENCY, items.length)) }, worker));

  const okCount = items.filter((i) => i.uploadStatus === 'done').length;
  pushLog(job, `Upload selesai: ${okCount} sukses, ${items.length - okCount} gagal.`);

  return { success: okCount > 0, job: spoofJobPublic(job) };
}

export function clearSpoofJob(jobId) {
  const job = spoofJobs.get(jobId);
  if (job) {
    for (const item of job.items) {
      item.bytes = null;
    }
  }
  spoofJobs.delete(jobId);
}