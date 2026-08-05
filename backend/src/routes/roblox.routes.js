import { Router } from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { BACKEND_ROOT } from '../config.js';
import { runFFmpeg } from '../services/ffmpeg.service.js';
import {
  uploadToRoblox,
  checkOperationStatus,
  checkAssetStatus,
  fetchWithRetry,
} from '../services/roblox.service.js';

const upload = multer({ dest: 'uploads/' });
const router = Router();

router.post('/upload-to-roblox', upload.single('file'), async (req, res) => {
  const {
    assetType = 'Audio',
    displayName = 'Untitled',
    description = '',
    creatorType = 'user',
    creatorId,
    apiKey,
  } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Missing file' });
  }

  if (!creatorId) {
    return res.status(400).json({ error: 'Missing creator ID' });
  }

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
    console.error('Roblox upload error:', error);
    res.status(error.status || 500).json({
      error: error.message || 'Upload failed',
      details: error.details,
    });
  } finally {
    if (req.file && existsSync(req.file.path)) {
      try { unlinkSync(req.file.path); } catch (e) { console.error('Cleanup error:', e); }
    }
  }
});

router.post('/upload-converted', async (req, res) => {
  const {
    fileId,
    displayName,
    description = '',
    creatorType = 'user',
    creatorId,
    apiKey,
  } = req.body;

  if (!fileId) {
    return res.status(400).json({ error: 'Missing fileId' });
  }
  if (!creatorId) {
    return res.status(400).json({ error: 'Missing creator ID' });
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'Missing API key' });
  }

  const filePath = join(BACKEND_ROOT, `${fileId}.mp3`);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File hasil convert sudah kadaluarsa. Convert ulang dulu.' });
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
    console.error('Roblox upload (converted) error:', error);
    res.status(error.status || 500).json({
      error: error.message || 'Upload failed',
      details: error.details,
    });
  } finally {
    if (existsSync(filePath)) {
      try { unlinkSync(filePath); } catch (e) { console.error('Cleanup error:', e); }
    }
  }
});

router.get('/operation-status/:operationId', async (req, res) => {
  const { apiKey } = req.query;

  if (!apiKey) {
    return res.status(400).json({ error: 'Missing API key' });
  }

  try {
    const result = await checkOperationStatus(req.params.operationId, apiKey);
    res.json(result);
  } catch (error) {
    console.error('Operation status error:', error);
    res.json({ done: false, error: 'Could not check upload status' });
  }
});

router.get('/asset-status/:assetId', async (req, res) => {
  const { apiKey } = req.query;
  try {
    const result = await checkAssetStatus(req.params.assetId, apiKey);
    res.json(result);
  } catch (error) {
    console.error('Asset status error:', error);
    res.json({ status: 'Pending', error: 'Could not check status' });
  }
});

router.get('/roblox/lookup', async (req, res) => {
  const input = String(req.query.url || req.query.id || '').trim();
  const forcedType = req.query.type === 'group' ? 'group' : req.query.type === 'user' ? 'user' : null;

  if (!input) {
    return res.status(400).json({ error: 'Masukkan URL profile atau group Roblox' });
  }

  const userMatch = input.match(/users\/(\d+)/);
  const groupMatch = input.match(/(?:communities|groups)\/(\d+)/);
  const plainId = /^\d+$/.test(input) ? input : null;

  const id = userMatch ? userMatch[1] : groupMatch ? groupMatch[1] : plainId;
  if (!id) {
    return res.status(400).json({ error: 'Tidak bisa menemukan ID dari URL tersebut' });
  }

  let type = forcedType || (userMatch ? 'user' : groupMatch ? 'group' : 'user');

  try {
    if (type === 'group') {
      const info = await fetchWithRetry(`https://groups.roblox.com/v1/groups/${id}`);
      if (!info.id) {
        return res.status(404).json({ error: 'Group tidak ditemukan' });
      }
      let thumbnail = null;
      try {
        const icons = await fetchWithRetry(
          `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${id}&size=420x420&format=Png`
        );
        if (icons.data && icons.data[0]) thumbnail = icons.data[0].imageUrl || null;
      } catch {
        thumbnail = null;
      }
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
    if (!info.id) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    let thumbnail = null;
    try {
      const avatars = await fetchWithRetry(
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${id}&size=150x150&format=Png&isCircular=false`
      );
      if (avatars.data && avatars.data[0]) thumbnail = avatars.data[0].imageUrl || null;
    } catch {
      thumbnail = null;
    }
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
    console.error('Roblox lookup error:', error);
    res.status(500).json({ error: error.message || 'Lookup failed' });
  }
});

router.get('/roblox/key-info', async (req, res) => {
  const apiKey = String(req.query.apiKey || '').trim();
  if (!apiKey) {
    return res.status(400).json({ error: 'Masukkan API key terlebih dahulu' });
  }

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
      return res.status(401).json({ error: 'API key tidak valid. Periksa kembali API key-nya.' });
    }

    if (!introspect || !introspect.authorizedUserId) {
      return res.status(401).json({ error: 'API key tidak valid. Periksa kembali API key-nya.' });
    }
    if (!introspect.enabled || introspect.expired) {
      return res.status(400).json({ error: 'API key ini tidak aktif atau sudah kedaluwarsa.' });
    }

    const ownerId = String(introspect.authorizedUserId);
    const scopes = Array.isArray(introspect.scopes) ? introspect.scopes : [];
    const scopeGroupIds = [...new Set(
      scopes.flatMap((s) => (Array.isArray(s.groupIds) ? s.groupIds : []))
    )].filter((g) => g !== '*');
    const scopeUserIds = [...new Set(
      scopes.flatMap((s) => (Array.isArray(s.userIds) ? s.userIds : []))
    )];

    const owner = await fetchWithRetry(`https://users.roblox.com/v1/users/${ownerId}`);
    let ownerThumbnail = null;
    try {
      const avatars = await fetchWithRetry(
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${ownerId}&size=150x150&format=Png&isCircular=false`
      );
      if (avatars.data && avatars.data[0]) ownerThumbnail = avatars.data[0].imageUrl || null;
    } catch {
      ownerThumbnail = null;
    }

    let audioQuota = null;
    try {
      const quota = await fetchWithRetry(
        `https://apis.roblox.com/cloud/v2/users/${ownerId}/asset-quotas`,
        2,
        { headers: { 'x-api-key': apiKey } }
      );
      const audioEntry = (Array.isArray(quota.assetQuotas) ? quota.assetQuotas : []).find(
        (q) => String(q.assetType || q.resourceType || '').toUpperCase() === 'AUDIO'
      );
      if (audioEntry) {
        audioQuota = {
          usage: audioEntry.usage != null ? Number(audioEntry.usage) : null,
          capacity: audioEntry.capacity != null ? Number(audioEntry.capacity) : null,
          period: audioEntry.period || 'MONTH',
          usageResetTime: audioEntry.usageResetTime || null,
        };
      }
    } catch {
      audioQuota = null;
    }

    const groups = [];
    for (const gid of scopeGroupIds) {
      try {
        const info = await fetchWithRetry(`https://groups.roblox.com/v1/groups/${gid}`);
        if (!info.id) continue;
        let thumb = null;
        try {
          const icons = await fetchWithRetry(
            `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${gid}&size=420x420&format=Png`
          );
          if (icons.data && icons.data[0]) thumb = icons.data[0].imageUrl || null;
        } catch {
          thumb = null;
        }
        groups.push({
          id: String(info.id),
          name: info.name,
          memberCount: info.memberCount,
          hasVerifiedBadge: !!info.hasVerifiedBadge,
          thumbnail: thumb,
        });
      } catch {
        // Skip failed group
      }
    }

    res.json({
      success: true,
      keyName: introspect.name || null,
      owner: {
        id: ownerId,
        name: owner.name,
        displayName: owner.displayName || null,
        hasVerifiedBadge: !!owner.hasVerifiedBadge,
        thumbnail: ownerThumbnail,
      },
      audioQuota,
      groups,
      scopeGroupIds,
      scopeUserIds,
    });
  } catch (error) {
    console.error('Key info error:', error);
    res.status(500).json({ error: error.message || 'Gagal memeriksa API key' });
  }
});

router.post('/spoof-asset', async (req, res) => {
  const {
    assetId,
    assetType = 'Animation',
    displayName,
    creatorType = 'user',
    creatorId,
    apiKey,
  } = req.body;

  if (!assetId) {
    return res.status(400).json({ error: 'Masukkan Roblox Asset ID' });
  }
  if (!creatorId || !apiKey) {
    return res.status(400).json({ error: 'Pilih Akun Roblox terlebih dahulu' });
  }

  const cleanAssetId = String(assetId).replace(/\D/g, '');
  if (!cleanAssetId) {
    return res.status(400).json({ error: 'Asset ID Roblox tidak valid' });
  }

  const tempFile = join(BACKEND_ROOT, `temp_spoof_${Date.now()}_${cleanAssetId}`);

  try {
    let downloadUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${cleanAssetId}`;

    try {
      const v2Res = await fetchWithRetry(`https://assetdelivery.roblox.com/v2/assetId/${cleanAssetId}`, {
        headers: { 'User-Agent': 'Roblox/WinInet' },
      });
      const v2Data = await v2Res.json();
      if (v2Data && v2Data.locations && v2Data.locations[0] && v2Data.locations[0].location) {
        downloadUrl = v2Data.locations[0].location;
      }
    } catch {
      // Fallback to v1 if v2 format differs
    }

    const rawRes = await fetchWithRetry(downloadUrl, {
      headers: { 'User-Agent': 'Roblox/WinInet' },
    });
    const arrayBuffer = await rawRes.arrayBuffer();
    const { writeFileSync } = await import('fs');
    writeFileSync(tempFile, Buffer.from(arrayBuffer));

    const finalTitle = displayName || `Spoofed_${assetType}_${cleanAssetId}`;

    const operationId = await uploadToRoblox(tempFile, {
      assetType,
      displayName: finalTitle,
      description: `Spoofed Asset (Original ID: ${cleanAssetId})`,
      creatorType,
      creatorId,
      apiKey,
    });

    res.json({
      success: true,
      operationId,
      title: finalTitle,
      originalAssetId: cleanAssetId,
    });
  } catch (error) {
    console.error('Spoof asset error:', error);
    res.status(500).json({ error: error.message || 'Gagal me-spoof asset Roblox' });
  } finally {
    if (existsSync(tempFile)) {
      try { unlinkSync(tempFile); } catch (e) { console.error('Cleanup temp error:', e); }
    }
  }
});

export default router;
