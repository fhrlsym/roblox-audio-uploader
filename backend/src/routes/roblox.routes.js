import { Router } from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { BACKEND_ROOT } from '../config.js';
import {
  uploadToRoblox,
  checkOperationStatus,
  checkAssetStatus,
  fetchWithRetry,
  detectAsset,
  performSpoof,
} from '../services/roblox.service.js';

const upload = multer({ dest: 'uploads/' });
const router = Router();

// ============================================================
// SPOOFER: Deteksi nama & tipe aset tanpa upload
// ============================================================
router.post('/spoof-detect', async (req, res) => {
  const { assetId } = req.body;
  if (!assetId) return res.status(400).json({ error: 'assetId wajib diisi' });

  const cleanId = String(assetId).replace(/\D/g, '');
  if (!cleanId) return res.status(400).json({ error: 'Asset ID Roblox tidak valid' });

  try {
    const asset = await detectAsset(cleanId);
    if (!asset.assetType) {
      return res.status(400).json({
        error: `Tidak bisa menentukan tipe aset. Aset mungkin private atau tidak valid.`,
      });
    }
    return res.json({ success: true, assetId: cleanId, name: asset.name, assetType: asset.assetType });
  } catch (error) {
    console.error('Spoof detect error:', error);
    res.status(500).json({ error: error.message || 'Gagal memeriksa aset' });
  }
});

// ============================================================
// SPOOFER: Generate Blank Asset + Return ID Baru
// ============================================================
router.post('/spoof', async (req, res) => {
  const {
    assetId,
    assetType,
    displayName,
    creatorType = 'user',
    creatorId,
    apiKey,
    cookie,
  } = req.body;

  if (!assetId || !creatorId || !apiKey) {
    return res.status(400).json({ error: 'assetId, creatorId, dan apiKey wajib diisi' });
  }

  const cleanAssetId = String(assetId).replace(/\D/g, '');

  try {
    const result = await performSpoof({ assetId: cleanAssetId, assetType, displayName, creatorType, creatorId, apiKey, cookie });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error || 'Gagal membuat asset spoof' });
    }
    return res.json({
      success: true,
      operationId: result.operationId,
      originalAssetId: result.originalAssetId,
      name: result.name,
      assetType: result.assetType,
    });
  } catch (error) {
    console.error('Spoof error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SPOOFER BATCH: Banyak asset sekaligus
// ============================================================
router.post('/spoof-batch', async (req, res) => {
  const {
    assets, // [{ assetId, assetType }]
    creatorType = 'user',
    creatorId,
    apiKey,
    cookie,
  } = req.body;

  if (!assets || !Array.isArray(assets) || assets.length === 0) {
    return res.status(400).json({ error: 'assets array wajib diisi' });
  }
  if (!creatorId || !apiKey) {
    return res.status(400).json({ error: 'creatorId dan apiKey wajib diisi' });
  }

  const results = [];
  const replacements = {};

  for (const asset of assets) {
    const cleanId = String(asset.assetId).replace(/\D/g, '');
    const key = asset.key ? String(asset.key) : cleanId;
    try {
      const spoofResult = await performSpoof({
        assetId: cleanId,
        assetType: asset.assetType,
        displayName: asset.displayName,
        creatorType: asset.creatorType || creatorType,
        creatorId,
        apiKey,
        cookie,
      });

      let newId = spoofResult.newAssetId;

      if (spoofResult.operationId && !newId) {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const opData = await checkOperationStatus(spoofResult.operationId, apiKey);
          if (opData.done) {
            newId = opData.assetId || null;
            break;
          }
        }
      }

      if (newId) {
        replacements[cleanId] = String(newId);
        results.push({
          key,
          oldId: cleanId,
          newAssetId: String(newId),
          newId: String(newId),
          name: spoofResult.name,
          assetType: spoofResult.assetType,
          success: true,
          status: 'Active',
        });
      } else {
        results.push({
          key,
          oldId: cleanId,
          name: spoofResult.name,
          assetType: spoofResult.assetType,
          success: false,
          error: spoofResult.error || 'Gagal generate ID',
        });
      }
    } catch (e) {
      results.push({ key, oldId: cleanId, success: false, error: e.message || 'Gagal' });
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  res.json({
    success: results.some(r => r.success),
    total: assets.length,
    successCount: results.filter(r => r.success).length,
    results,
    replacements,
  });
});

// ============================================================
// ENDPOINT: Cek status operasi upload
// ============================================================
router.get('/operation-status/:operationId', async (req, res) => {
  const { apiKey } = req.query;
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });

  try {
    const result = await checkOperationStatus(req.params.operationId, apiKey);
    res.json(result);
  } catch (error) {
    res.json({ done: false, error: 'Could not check upload status' });
  }
});

// ============================================================
// ENDPOINT: Upload file ke Roblox
// ============================================================
router.post('/upload-to-roblox', upload.single('file'), async (req, res) => {
  const {
    assetType = 'Audio',
    displayName = 'Untitled',
    description = '',
    creatorType = 'user',
    creatorId,
    apiKey,
  } = req.body;

  if (!req.file) return res.status(400).json({ error: 'Missing file' });
  if (!creatorId) return res.status(400).json({ error: 'Missing creator ID' });

  try {
    const operationId = await uploadToRoblox(req.file.path, {
      assetType,
      displayName,
      description,
      creatorType,
      creatorId,
      apiKey,
    });
    res.json({ operationId });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || 'Upload failed',
      details: error.details,
    });
  } finally {
    if (req.file && existsSync(req.file.path)) {
      try { unlinkSync(req.file.path); } catch {}
    }
  }
});

// ============================================================
// ENDPOINT: Upload hasil convert
// ============================================================
router.post('/upload-converted', async (req, res) => {
  const {
    fileId,
    displayName,
    description = '',
    creatorType = 'user',
    creatorId,
    apiKey,
  } = req.body;

  if (!fileId) return res.status(400).json({ error: 'Missing fileId' });
  if (!creatorId) return res.status(400).json({ error: 'Missing creator ID' });
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });

  const filePath = join(BACKEND_ROOT, `${fileId}.mp3`);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File hasil convert sudah kadaluarsa.' });
  }

  try {
    const operationId = await uploadToRoblox(filePath, {
      assetType: 'Audio',
      displayName: displayName || fileId,
      description,
      creatorType,
      creatorId,
      apiKey,
    });
    res.json({ operationId });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Upload failed' });
  } finally {
    if (existsSync(filePath)) {
      try { unlinkSync(filePath); } catch {}
    }
  }
});

// ============================================================
// ENDPOINT: Cek status asset
// ============================================================
router.get('/asset-status/:assetId', async (req, res) => {
  const { apiKey } = req.query;
  try {
    const result = await checkAssetStatus(req.params.assetId, apiKey);
    res.json(result);
  } catch (error) {
    res.json({ status: 'Pending', error: 'Could not check status' });
  }
});

// ============================================================
// ENDPOINT: Lookup user/group Roblox
// ============================================================
router.get('/roblox/lookup', async (req, res) => {
  const input = String(req.query.url || req.query.id || '').trim();
  const forcedType = req.query.type === 'group' ? 'group' : req.query.type === 'user' ? 'user' : null;

  if (!input) return res.status(400).json({ error: 'Masukkan URL profile atau group Roblox' });

  const userMatch = input.match(/users\/(\d+)/);
  const groupMatch = input.match(/(?:communities|groups)\/(\d+)/);
  const plainId = /^\d+$/.test(input) ? input : null;

  const id = userMatch ? userMatch[1] : groupMatch ? groupMatch[1] : plainId;
  if (!id) return res.status(400).json({ error: 'Tidak bisa menemukan ID dari URL tersebut' });

  let type = forcedType || (userMatch ? 'user' : groupMatch ? 'group' : 'user');

  try {
    if (type === 'group') {
      const info = await fetchWithRetry(`https://groups.roblox.com/v1/groups/${id}`);
      if (!info.id) return res.status(404).json({ error: 'Group tidak ditemukan' });
      let thumbnail = null;
      try {
        const icons = await fetchWithRetry(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${id}&size=420x420&format=Png`);
        if (icons.data?.[0]) thumbnail = icons.data[0].imageUrl;
      } catch {}
      return res.json({
        result: {
          id: String(info.id),
          type: 'group',
          name: info.name,
          memberCount: info.memberCount,
          hasVerifiedBadge: !!info.hasVerifiedBadge,
          thumbnail,
        },
      });
    }

    const info = await fetchWithRetry(`https://users.roblox.com/v1/users/${id}`);
    if (!info.id) return res.status(404).json({ error: 'User tidak ditemukan' });
    let thumbnail = null;
    try {
      const avatars = await fetchWithRetry(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${id}&size=150x150&format=Png&isCircular=false`);
      if (avatars.data?.[0]) thumbnail = avatars.data[0].imageUrl;
    } catch {}
    res.json({
      result: {
        id: String(info.id),
        type: 'user',
        name: info.name,
        displayName: info.displayName,
        hasVerifiedBadge: !!info.hasVerifiedBadge,
        thumbnail,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Lookup failed' });
  }
});

// ============================================================
// ENDPOINT: Key Info & Quota
// ============================================================
router.get('/roblox/key-info', async (req, res) => {
  const apiKey = String(req.query.apiKey || '').trim();
  if (!apiKey) return res.status(400).json({ error: 'Masukkan API key terlebih dahulu' });

  try {
    let introspect;
    try {
      const r = await fetch('https://apis.roblox.com/api-keys/v1/introspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error('introspect failed');
      introspect = data;
    } catch {
      return res.status(401).json({ error: 'API key tidak valid.' });
    }

    if (!introspect?.authorizedUserId) return res.status(401).json({ error: 'API key tidak valid.' });
    if (!introspect.enabled || introspect.expired) return res.status(400).json({ error: 'API key tidak aktif atau kedaluwarsa.' });

    const ownerId = String(introspect.authorizedUserId);
    const scopes = Array.isArray(introspect.scopes) ? introspect.scopes : [];
    const scopeGroupIds = [...new Set(scopes.flatMap((s) => Array.isArray(s.groupIds) ? s.groupIds : []))].filter((g) => g !== '*');
    const scopeUserIds = [...new Set(scopes.flatMap((s) => Array.isArray(s.userIds) ? s.userIds : []))];

    const owner = await fetchWithRetry(`https://users.roblox.com/v1/users/${ownerId}`);
    let ownerThumbnail = null;
    try {
      const avatars = await fetchWithRetry(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${ownerId}&size=150x150&format=Png&isCircular=false`);
      if (avatars.data?.[0]) ownerThumbnail = avatars.data[0].imageUrl;
    } catch {}

    let audioQuota = null;
    try {
      const quota = await fetchWithRetry(`https://apis.roblox.com/cloud/v2/users/${ownerId}/asset-quotas`, 2, { headers: { 'x-api-key': apiKey } });
      const audioEntry = (Array.isArray(quota.assetQuotas) ? quota.assetQuotas : []).find(
        (q) => String(q.assetType || q.resourceType || '').toUpperCase() === 'AUDIO'
      );
      if (audioEntry) {
        audioQuota = {
          usage: Number(audioEntry.usage) || 0,
          capacity: Number(audioEntry.capacity) || 0,
          period: audioEntry.period || 'MONTH',
          usageResetTime: audioEntry.usageResetTime || null,
        };
      }
    } catch {}

    const groups = [];
    for (const gid of scopeGroupIds) {
      try {
        const info = await fetchWithRetry(`https://groups.roblox.com/v1/groups/${gid}`);
        if (!info.id) continue;
        let thumb = null;
        try {
          const icons = await fetchWithRetry(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${gid}&size=420x420&format=Png`);
          if (icons.data?.[0]) thumb = icons.data[0].imageUrl;
        } catch {}
        groups.push({
          id: String(info.id),
          name: info.name,
          memberCount: info.memberCount,
          hasVerifiedBadge: !!info.hasVerifiedBadge,
          thumbnail: thumb,
        });
      } catch {}
    }

    res.json({
      success: true,
      keyName: introspect.name || null,
      owner: { id: ownerId, name: owner.name, displayName: owner.displayName || null, hasVerifiedBadge: !!owner.hasVerifiedBadge, thumbnail: ownerThumbnail },
      audioQuota,
      groups,
      scopeGroupIds,
      scopeUserIds,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Gagal memeriksa API key' });
  }
});

// ============================================================
// ENDPOINT: Quota
// ============================================================
router.get('/roblox-quota', async (req, res) => {
  const apiKey = String(req.query.apiKey || '').trim();
  const targetId = String(req.query.targetId || '').trim();
  const targetType = req.query.targetType === 'group' ? 'group' : 'user';

  if (!apiKey || !targetId) return res.status(400).json({ error: 'Missing API key or target ID' });

  let effectiveUserId = targetId;
  if (targetType === 'group') {
    try {
      const r = await fetch('https://apis.roblox.com/api-keys/v1/introspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.authorizedUserId) effectiveUserId = String(d.authorizedUserId);
    } catch {}
  }

  try {
    const quota = await fetchWithRetry(`https://apis.roblox.com/cloud/v2/users/${effectiveUserId}/asset-quotas`, 2, { headers: { 'x-api-key': apiKey } });
    const audioEntry = (Array.isArray(quota.assetQuotas) ? quota.assetQuotas : []).find(
      (q) => String(q.assetType || q.resourceType || '').toUpperCase() === 'AUDIO'
    );
    if (!audioEntry) return res.json({ usage: 0, capacity: 0, period: 'MONTH' });
    res.json({
      usage: Number(audioEntry.usage) || 0,
      capacity: Number(audioEntry.capacity) || 0,
      period: audioEntry.period || 'MONTH',
      usageResetTime: audioEntry.usageResetTime || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Gagal mengambil kuota Roblox' });
  }
});

export default router;