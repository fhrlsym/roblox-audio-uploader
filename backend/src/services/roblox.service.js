import fetch from 'node-fetch';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { sleep, BACKEND_ROOT } from '../config.js';
import { generateSilentMp3 } from './ffmpeg.service.js';

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
  const isAudio = fileType.toLowerCase() === 'audio' || fileType.toLowerCase() === 'sound';
  const fileExt = isAudio ? 'mp3' : 'rbx';
  const fileContentType = isAudio ? 'audio/mpeg' : 'application/octet-stream';

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

export async function performSpoof({ assetId, assetType, displayName, creatorType = 'user', creatorId, apiKey }) {
  const cleanAssetId = String(assetId).replace(/\D/g, '');
  let detected = null;
  try {
    detected = await detectAsset(cleanAssetId);
  } catch {
    // detectAsset tidak boleh menggagalkan proses; lanjut dengan nilai default
  }
  const assetName = displayName || detected?.name || `Spoofed_${cleanAssetId}`;
  const finalType = assetType || detected?.assetType || 'Audio';

  // Roblox Assets API hanya menerima multipart/form-data (request + fileContent).
  // File kosong ditolak moderasi ("Failed to parse file"), jadi kita buat file VALID:
  //   - Audio  -> mp3 senyap pendek (ffmpeg)
  //   - lainnya-> belum didukung file blank yang valid
  if (finalType !== 'Audio') {
    return {
      success: false,
      asset: null,
      error: `Tipe ${finalType} belum didukung pembuatan file valid untuk spoof.`,
    };
  }

  const tempFile = join(BACKEND_ROOT, `spoof_${Date.now()}_${cleanAssetId}.mp3`);
  await generateSilentMp3(tempFile, 1);

  try {
    const operationId = await uploadToRoblox(tempFile, {
      assetType: finalType,
      displayName: assetName,
      description: `Spoofed from ${cleanAssetId}`,
      creatorType,
      creatorId,
      apiKey,
    });

    return {
      success: true,
      operationId,
      originalAssetId: cleanAssetId,
      name: assetName,
      assetType: finalType,
    };
  } finally {
    if (existsSync(tempFile)) {
      try { unlinkSync(tempFile); } catch {}
    }
  }
}
