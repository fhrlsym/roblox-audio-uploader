import { Router } from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
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

// ============================================================
// HELPER: Dapatkan X-CSRF-TOKEN dari Roblox
// ============================================================
async function getCsrfToken(cookie) {
  try {
    const res = await fetch('https://auth.roblox.com/v2/logout', {
      method: 'POST',
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'RobloxStudio/WinInet',
      },
    });
    return res.headers.get('x-csrf-token') || '';
  } catch {
    return '';
  }
}

// ============================================================
// HELPER: Build headers dengan cookie & CSRF
// ============================================================
async function buildRobloxHeaders(cookie) {
  const headers = {
    'User-Agent': 'RobloxStudio/WinInet',
    'Accept': '*/*',
  };

  if (cookie) {
    const csrf = await getCsrfToken(cookie);
    headers['Cookie'] = `.ROBLOSECURITY=${cookie}`;
    if (csrf) headers['X-CSRF-TOKEN'] = csrf;
  }

  return headers;
}

// ============================================================
// HELPER: Download asset dari Roblox CDN (10 strategi)
// ============================================================
async function downloadAssetFromRoblox(cleanAssetId, assetType, headers, apiKey) {
  let arrayBuffer = null;
  let assetHash = null;

  // Deteksi hash dari economy API
  try {
    const ecoCheck = await fetch(`https://economy.roblox.com/v2/assets/${cleanAssetId}/details`, { headers });
    const ecoInfo = await ecoCheck.json().catch(() => ({}));
    if (ecoInfo.AssetHash) assetHash = ecoInfo.AssetHash;
  } catch {}

  // S1: AssetDelivery Direct
  try {
    const deliveryUrls = [
      `https://assetdelivery.roblox.com/v1/asset?id=${cleanAssetId}&version=1&clientInsert=1`,
      `https://assetdelivery.roblox.com/v1/asset/?id=${cleanAssetId}&format=binary`,
      `https://assetdelivery.roblox.com/v1/asset/?assetId=${cleanAssetId}&assetTypeId=${assetType === 'Audio' ? 3 : 24}`,
      `https://assetdelivery.roblox.com/v1/asset/?id=${cleanAssetId}&skipScript=true`,
    ];
    for (const url of deliveryUrls) {
      if (arrayBuffer) break;
      try {
        const res = await fetch(url, { headers });
        if (res.ok && res.status !== 403) {
          const buf = await res.arrayBuffer();
          if (buf.byteLength > 100) arrayBuffer = buf;
        }
      } catch {}
    }
  } catch (e) { console.warn('[S1] Gagal:', e.message); }

  // S2: Redirect manual
  if (!arrayBuffer) {
    try {
      const redirRes = await fetch(
        `https://assetdelivery.roblox.com/v1/asset?id=${cleanAssetId}`,
        { redirect: 'manual', headers }
      );
      const location = redirRes.headers.get('location');
      if (location) {
        const cdnRes = await fetch(location, { headers });
        if (cdnRes.ok) {
          const buf = await cdnRes.arrayBuffer();
          if (buf.byteLength > 100) arrayBuffer = buf;
        }
      }
    } catch (e) { console.warn('[S2] Gagal:', e.message); }
  }

  // S3: Batch API v2
  if (!arrayBuffer) {
    try {
      const batchRes = await fetch('https://assetdelivery.roblox.com/v2/assets/batch', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          assetId: Number(cleanAssetId),
          requestId: '1',
          assetType: assetType === 'Audio' ? 'Audio' : 'Animation',
        }]),
      });
      const batchData = await batchRes.json().catch(() => []);
      const loc = batchData?.[0]?.locations?.[0]?.location;
      if (loc) {
        const cdnRes = await fetch(loc, { headers });
        if (cdnRes.ok) {
          const buf = await cdnRes.arrayBuffer();
          if (buf.byteLength > 100) arrayBuffer = buf;
        }
      }
    } catch (e) { console.warn('[S3] Gagal:', e.message); }
  }

  // S4: CDN Hash multi-host
  if (!arrayBuffer && assetHash) {
    try {
      const cdnHosts = [
        't0.rbxcdn.com', 't1.rbxcdn.com', 't2.rbxcdn.com', 't3.rbxcdn.com',
        't4.rbxcdn.com', 't5.rbxcdn.com', 't6.rbxcdn.com', 't7.rbxcdn.com',
        'c0.rbxcdn.com', 'c1.rbxcdn.com', 'c2.rbxcdn.com',
      ];
      for (const host of cdnHosts) {
        if (arrayBuffer) break;
        try {
          const cdnRes = await fetch(`https://${host}/${assetHash}`, { headers });
          if (cdnRes.ok) {
            const buf = await cdnRes.arrayBuffer();
            if (buf.byteLength > 100) arrayBuffer = buf;
          }
        } catch {}
      }
    } catch (e) { console.warn('[S4] Gagal:', e.message); }
  }

  // S5: Saved Versions
  if (!arrayBuffer) {
    try {
      const verRes = await fetch(`https://develop.roblox.com/v1/assets/${cleanAssetId}/saved-versions`, { headers });
      const verData = await verRes.json().catch(() => ({}));
      const versions = verData?.data || [];
      for (const ver of versions.reverse()) {
        if (arrayBuffer) break;
        const verId = ver?.assetVersionId || ver?.id;
        if (verId) {
          try {
            const binRes = await fetch(`https://assetdelivery.roblox.com/v1/assetversion?assetVersionId=${verId}`, { headers });
            if (binRes.ok) {
              const buf = await binRes.arrayBuffer();
              if (buf.byteLength > 100) arrayBuffer = buf;
            }
          } catch {}
        }
      }
    } catch (e) { console.warn('[S5] Gagal:', e.message); }
  }

  // S6: Cloud API Versions
  if (!arrayBuffer && apiKey) {
    try {
      const cloudRes = await fetch(`https://apis.roblox.com/cloud/v2/assets/${cleanAssetId}/versions`, {
        headers: { ...headers, 'x-api-key': apiKey },
      });
      const cloudData = await cloudRes.json().catch(() => ({}));
      const versions = cloudData?.data || cloudData?.versions || [];
      for (const ver of versions) {
        if (arrayBuffer) break;
        const verId = ver.id || ver.assetVersionId;
        if (verId) {
          try {
            const binRes = await fetch(`https://assetdelivery.roblox.com/v1/assetversion?assetVersionId=${verId}`, { headers });
            if (binRes.ok) {
              const buf = await binRes.arrayBuffer();
              if (buf.byteLength > 100) arrayBuffer = buf;
            }
          } catch {}
        }
      }
    } catch (e) { console.warn('[S6] Gagal:', e.message); }
  }

  // S7: Place ID Context
  if (!arrayBuffer) {
    try {
      const uniRes = await fetch(`https://games.roblox.com/v1/games/asset-to-universe?assetId=${cleanAssetId}`, { headers });
      const uniData = await uniRes.json().catch(() => ({}));
      const universeId = uniData?.universeId || uniData?.universeIds?.[0];
      if (universeId) {
        const placeRes = await fetch(`https://games.roblox.com/v1/games/multiget-place-details?universeIds=${universeId}`, { headers });
        const placeData = await placeRes.json().catch(() => []);
        const placeId = placeData?.[0]?.placeId;
        if (placeId) {
          const gameHeaders = {
            ...headers,
            'Roblox-Place-Id': String(placeId),
            'Roblox-Game-Id': String(universeId),
            'Requester': 'Client',
          };
          const binRes = await fetch(
            `https://assetdelivery.roblox.com/v1/asset/?id=${cleanAssetId}&placeId=${placeId}&clientInsert=1`,
            { headers: gameHeaders }
          );
          if (binRes.ok) {
            const buf = await binRes.arrayBuffer();
            if (buf.byteLength > 100) arrayBuffer = buf;
          }
        }
      }
    } catch (e) { console.warn('[S7] Gagal:', e.message); }
  }

  // S8: Avatar Animation API
  if (!arrayBuffer && assetType === 'Animation') {
    try {
      const avatarRes = await fetch(`https://avatar.roblox.com/v1/asset/${cleanAssetId}/animation`, { headers });
      if (avatarRes.ok) {
        const animData = await avatarRes.json().catch(() => ({}));
        if (animData?.url) {
          const binRes = await fetch(animData.url, { headers });
          if (binRes.ok) {
            const buf = await binRes.arrayBuffer();
            if (buf.byteLength > 100) arrayBuffer = buf;
          }
        }
      }
    } catch (e) { console.warn('[S8] Gagal:', e.message); }
  }

  // S9: Catalog Internal
  if (!arrayBuffer) {
    try {
      const catalogRes = await fetch(`https://catalog.roblox.com/v1/catalog/items/${cleanAssetId}/details`, { headers });
      if (catalogRes.ok) {
        const catalogData = await catalogRes.json().catch(() => ({}));
        // Coba extract URL jika ada
        const urlsToTry = [
          catalogData?.url,
          catalogData?.assetUrl,
          catalogData?.downloadUrl,
          catalogData?.location,
        ].filter(Boolean);
        for (const url of urlsToTry) {
          if (arrayBuffer) break;
          try {
            const binRes = await fetch(url, { headers });
            if (binRes.ok) {
              const buf = await binRes.arrayBuffer();
              if (buf.byteLength > 100) arrayBuffer = buf;
            }
          } catch {}
        }
      }
    } catch (e) { console.warn('[S9] Gagal:', e.message); }
  }

  // S10: Toolbox Service
  if (!arrayBuffer) {
    try {
      const tbRes = await fetch(`https://apis.roblox.com/toolbox-service/v1/items/details?assetIds=${cleanAssetId}`, { headers });
      const tbData = await tbRes.json().catch(() => ({}));
      const asset = tbData?.data?.[0]?.asset;
      if (asset?.assetHash) {
        const cdnHosts = ['t0.rbxcdn.com', 't1.rbxcdn.com', 'c0.rbxcdn.com'];
        for (const host of cdnHosts) {
          if (arrayBuffer) break;
          try {
            const cdnRes = await fetch(`https://${host}/${asset.assetHash}`, { headers });
            if (cdnRes.ok) {
              const buf = await cdnRes.arrayBuffer();
              if (buf.byteLength > 100) arrayBuffer = buf;
            }
          } catch {}
        }
      }
    } catch (e) { console.warn('[S10] Gagal:', e.message); }
  }

  return arrayBuffer;
}

// ============================================================
// ENDPOINT: Spoof Asset (10 Strategi Download + Reupload)
// ============================================================
router.post('/spoof-asset', async (req, res) => {
  const {
    assetId,
    assetType = 'Animation',
    displayName,
    creatorType = 'user',
    creatorId,
    apiKey,
    robloxCookie,
  } = req.body;

  if (!assetId) return res.status(400).json({ error: 'Masukkan Roblox Asset ID' });
  if (!creatorId || !apiKey) return res.status(400).json({ error: 'Pilih Akun Roblox terlebih dahulu' });

  const cleanAssetId = String(assetId).replace(/\D/g, '');
  if (!cleanAssetId) return res.status(400).json({ error: 'Asset ID Roblox tidak valid' });

  const tempFile = join(BACKEND_ROOT, `temp_spoof_${Date.now()}_${cleanAssetId}`);
  const headers = await buildRobloxHeaders(robloxCookie);

  // Deteksi tipe asset
  let detectedAssetType = assetType;
  try {
    const ecoCheck = await fetch(`https://economy.roblox.com/v2/assets/${cleanAssetId}/details`, { headers });
    const ecoInfo = await ecoCheck.json().catch(() => ({}));
    if (ecoInfo.AssetTypeId === 3) detectedAssetType = 'Audio';
    else if (ecoInfo.AssetTypeId === 24) detectedAssetType = 'Animation';
  } catch {}

  try {
    const arrayBuffer = await downloadAssetFromRoblox(cleanAssetId, detectedAssetType, headers, apiKey);

    if (!arrayBuffer || arrayBuffer.byteLength < 100) {
      throw new Error(
        `ID ${cleanAssetId} tidak dapat di-download (${detectedAssetType}). ` +
        `Semua 10 strategi gagal. Asset kemungkinan benar-benar privat/dihapus.`
      );
    }

    writeFileSync(tempFile, Buffer.from(arrayBuffer));

    const finalTitle = displayName || `Spoofed_${detectedAssetType}_${cleanAssetId}`;

    const operationId = await uploadToRoblox(tempFile, {
      assetType: detectedAssetType,
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
      detectedAssetType,
      fileSize: arrayBuffer.byteLength,
    });
  } catch (error) {
    console.error('Spoof asset error:', error);
    res.status(500).json({
      error: error.message || 'Gagal me-spoof asset Roblox',
      detectedAssetType,
    });
  } finally {
    if (existsSync(tempFile)) {
      try { unlinkSync(tempFile); } catch {}
    }
  }
});

// ============================================================
// ENDPOINT: Force Download Private Asset (10 Strategi)
// ============================================================
router.post('/spoof-force-download', async (req, res) => {
  const {
    assetId,
    assetType = 'Animation',
    displayName,
    creatorType = 'user',
    creatorId,
    apiKey,
    robloxCookie,
  } = req.body;

  if (!assetId || !creatorId || !apiKey) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const cleanAssetId = String(assetId).replace(/\D/g, '');
  const tempFile = join(BACKEND_ROOT, `force_spoof_${Date.now()}_${cleanAssetId}`);
  const headers = await buildRobloxHeaders(robloxCookie);

  // Deteksi tipe asset
  let detectedAssetType = assetType;
  try {
    const ecoCheck = await fetch(`https://economy.roblox.com/v2/assets/${cleanAssetId}/details`, { headers });
    const ecoInfo = await ecoCheck.json().catch(() => ({}));
    if (ecoInfo.AssetTypeId === 3) detectedAssetType = 'Audio';
    else if (ecoInfo.AssetTypeId === 24) detectedAssetType = 'Animation';
  } catch {}

  try {
    const arrayBuffer = await downloadAssetFromRoblox(cleanAssetId, detectedAssetType, headers, apiKey);

    if (!arrayBuffer || arrayBuffer.byteLength < 100) {
      return res.status(404).json({
        error: 'Asset TIDAK BISA di-download dari Roblox. Semua 10 strategi gagal.',
        assetId: cleanAssetId,
        detectedAssetType,
        triedStrategies: 10,
      });
    }

    writeFileSync(tempFile, Buffer.from(arrayBuffer));

    const finalTitle = displayName || `ForceSpoofed_${detectedAssetType}_${cleanAssetId}`;

    const operationId = await uploadToRoblox(tempFile, {
      assetType: detectedAssetType,
      displayName: finalTitle,
      description: `Force spoofed (Original: ${cleanAssetId})`,
      creatorType,
      creatorId,
      apiKey,
    });

    res.json({
      success: true,
      operationId,
      title: finalTitle,
      originalAssetId: cleanAssetId,
      detectedAssetType,
      fileSize: arrayBuffer.byteLength,
    });
  } catch (error) {
    console.error('Force download error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (existsSync(tempFile)) {
      try { unlinkSync(tempFile); } catch {}
    }
  }
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
    res.status(error.status || 500).json({
      error: error.message || 'Upload failed',
      details: error.details,
    });
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