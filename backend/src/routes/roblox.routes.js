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
// ENDPOINT: Spoof Asset (6 Strategi Download + Reupload)
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
  const headers = await buildRobloxHeaders(robloxCookie);

  // Deteksi tipe asset sebenarnya
  let detectedAssetType = assetType;
  let assetHash = null;
  
  try {
    const ecoCheck = await fetch(`https://economy.roblox.com/v2/assets/${cleanAssetId}/details`, {
      headers,
    });
    const ecoInfo = await ecoCheck.json().catch(() => ({}));
    
    if (ecoInfo.AssetTypeId === 3) detectedAssetType = 'Audio';
    else if (ecoInfo.AssetTypeId === 24) detectedAssetType = 'Animation';
    
    if (ecoInfo.AssetHash) assetHash = ecoInfo.AssetHash;
  } catch {}

  try {
    let arrayBuffer = null;

    // ============================================================
    // STRATEGY 1: AssetDelivery Direct (dengan cookie)
    // ============================================================
    try {
      const res = await fetch(
        `https://assetdelivery.roblox.com/v1/asset/?id=${cleanAssetId}`,
        { headers }
      );
      if (res.ok && res.status !== 403) {
        arrayBuffer = await res.arrayBuffer();
      }
    } catch (e) {
      console.warn('[S1] AssetDelivery Direct gagal:', e.message);
    }

    // ============================================================
    // STRATEGY 2: AssetDelivery dengan redirect manual
    // ============================================================
    if (!arrayBuffer) {
      try {
        const redirRes = await fetch(
          `https://assetdelivery.roblox.com/v1/asset/?id=${cleanAssetId}`,
          { redirect: 'manual', headers }
        );
        const location = redirRes.headers.get('location');
        if (location) {
          const binRes = await fetch(location, { headers });
          if (binRes.ok) {
            arrayBuffer = await binRes.arrayBuffer();
          }
        }
      } catch (e) {
        console.warn('[S2] Redirect manual gagal:', e.message);
      }
    }

    // ============================================================
    // STRATEGY 3: Batch API v2
    // ============================================================
    if (!arrayBuffer) {
      try {
        const batchRes = await fetch('https://assetdelivery.roblox.com/v2/assets/batch', {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{
            assetId: Number(cleanAssetId),
            requestId: '1',
          }]),
        });
        const batchData = await batchRes.json().catch(() => []);
        const loc = batchData?.[0]?.locations?.[0]?.location;
        if (loc) {
          const binRes = await fetch(loc, { headers });
          if (binRes.ok) {
            arrayBuffer = await binRes.arrayBuffer();
          }
        }
      } catch (e) {
        console.warn('[S3] Batch API gagal:', e.message);
      }
    }

    // ============================================================
    // STRATEGY 4: CDN Hash langsung (rbxcdn.com)
    // ============================================================
    if (!arrayBuffer && assetHash) {
      try {
        const cdnUrls = [
          `https://t0.rbxcdn.com/${assetHash}`,
          `https://t1.rbxcdn.com/${assetHash}`,
          `https://t2.rbxcdn.com/${assetHash}`,
          `https://c0.rbxcdn.com/${assetHash}`,
          `https://c1.rbxcdn.com/${assetHash}`,
        ];
        
        for (const url of cdnUrls) {
          try {
            const binRes = await fetch(url, { headers });
            if (binRes.ok) {
              arrayBuffer = await binRes.arrayBuffer();
              break;
            }
          } catch {}
        }
      } catch (e) {
        console.warn('[S4] CDN Hash gagal:', e.message);
      }
    }

    // ============================================================
    // STRATEGY 5: Saved Versions (untuk animasi)
    // ============================================================
    if (!arrayBuffer && detectedAssetType === 'Animation') {
      try {
        const verRes = await fetch(
          `https://develop.roblox.com/v1/assets/${cleanAssetId}/saved-versions`,
          { headers }
        );
        const verData = await verRes.json().catch(() => ({}));
        const versions = verData?.data || [];
        
        if (versions.length > 0) {
          const latest = versions[versions.length - 1];
          if (latest?.assetVersionId) {
            const binRes = await fetch(
              `https://assetdelivery.roblox.com/v1/assetversion?assetVersionId=${latest.assetVersionId}`,
              { headers }
            );
            if (binRes.ok) {
              arrayBuffer = await binRes.arrayBuffer();
            }
          }
        }
      } catch (e) {
        console.warn('[S5] Saved Versions gagal:', e.message);
      }
    }

    // ============================================================
    // STRATEGY 6: Place ID Context Emulation
    // ============================================================
    if (!arrayBuffer) {
      try {
        const uniRes = await fetch(
          `https://games.roblox.com/v1/games/asset-to-universe?assetId=${cleanAssetId}`,
          { headers }
        );
        const uniData = await uniRes.json().catch(() => ({}));
        const universeId = uniData?.universeId || uniData?.universeIds?.[0];
        
        let placeId = null;
        if (universeId) {
          const placeRes = await fetch(
            `https://games.roblox.com/v1/games/multiget-place-details?universeIds=${universeId}`,
            { headers }
          );
          const placeData = await placeRes.json().catch(() => []);
          placeId = placeData?.[0]?.placeId;
        }

        if (placeId) {
          const binRes = await fetch(
            `https://assetdelivery.roblox.com/v1/asset/?id=${cleanAssetId}&placeId=${placeId}&serverplaceid=${placeId}&expectedAssetType=${detectedAssetType}&clientInsert=1`,
            { headers: { ...headers, 'Roblox-Place-Id': String(placeId) } }
          );
          if (binRes.ok) {
            arrayBuffer = await binRes.arrayBuffer();
          }
        }
      } catch (e) {
        console.warn('[S6] Place Context gagal:', e.message);
      }
    }

    // ============================================================
    // STRATEGY 7: Search API (bypass untuk private audio)
    // ============================================================
    if (!arrayBuffer && detectedAssetType === 'Audio') {
      try {
        // Gunakan search API untuk cari audio serupa
        const searchRes = await fetch(
          `https://search.roblox.com/catalog/items?assetTypeId=3&keyword=${cleanAssetId}&limit=10`,
          { headers }
        );
        const searchData = await searchRes.json().catch(() => ({}));
        // Tidak bisa langsung ambil, return error dengan info
        throw new Error(`Audio ID ${cleanAssetId} adalah private. Gunakan fitur "Auto Upload ID Baru" dengan download dari YouTube.`);
      } catch (e) {
        if (e.message.includes('private')) throw e;
        console.warn('[S7] Search API gagal:', e.message);
      }
    }

    // ============================================================
    // GAGAL TOTAL — Kembalikan error
    // ============================================================
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error(
        `ID ${cleanAssetId} tidak dapat di-spoof (${detectedAssetType}). ` +
        `Asset kemungkinan private, di-moderate, atau dihapus.`
      );
    }

    // ============================================================
    // SUKSES — Simpan & Reupload
    // ============================================================
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
    });

  } catch (error) {
    console.error('Spoof asset error:', error);
    res.status(500).json({ 
      error: error.message || 'Gagal me-spoof asset Roblox',
      detectedAssetType,
      isPrivateAudio: detectedAssetType === 'Audio' && error.message.includes('private'),
    });
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
      if (!info.id) return res.status(404).json({ error: 'Group tidak ditemukan' });
      
      let thumbnail = null;
      try {
        const icons = await fetchWithRetry(
          `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${id}&size=420x420&format=Png`
        );
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
      const avatars = await fetchWithRetry(
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${id}&size=150x150&format=Png&isCircular=false`
      );
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
      return res.status(401).json({ error: 'API key tidak valid. Periksa kembali API key-nya.' });
    }

    if (!introspect?.authorizedUserId) {
      return res.status(401).json({ error: 'API key tidak valid.' });
    }
    if (!introspect.enabled || introspect.expired) {
      return res.status(400).json({ error: 'API key tidak aktif atau sudah kedaluwarsa.' });
    }

    const ownerId = String(introspect.authorizedUserId);
    const scopes = Array.isArray(introspect.scopes) ? introspect.scopes : [];
    const scopeGroupIds = [...new Set(
      scopes.flatMap((s) => Array.isArray(s.groupIds) ? s.groupIds : [])
    )].filter((g) => g !== '*');
    const scopeUserIds = [...new Set(
      scopes.flatMap((s) => Array.isArray(s.userIds) ? s.userIds : []))
    ];

    const owner = await fetchWithRetry(`https://users.roblox.com/v1/users/${ownerId}`);
    let ownerThumbnail = null;
    try {
      const avatars = await fetchWithRetry(
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${ownerId}&size=150x150&format=Png&isCircular=false`
      );
      if (avatars.data?.[0]) ownerThumbnail = avatars.data[0].imageUrl;
    } catch {}

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
          const icons = await fetchWithRetry(
            `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${gid}&size=420x420&format=Png`
          );
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

  if (!apiKey || !targetId) {
    return res.status(400).json({ error: 'Missing API key or target ID' });
  }

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
    const quota = await fetchWithRetry(
      `https://apis.roblox.com/cloud/v2/users/${effectiveUserId}/asset-quotas`,
      2,
      { headers: { 'x-api-key': apiKey } }
    );
    const audioEntry = (Array.isArray(quota.assetQuotas) ? quota.assetQuotas : []).find(
      (q) => String(q.assetType || q.resourceType || '').toUpperCase() === 'AUDIO'
    );
    if (!audioEntry) {
      return res.json({ usage: 0, capacity: 0, period: 'MONTH' });
    }
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