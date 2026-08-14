// Honest client-side static analysis. This is NOT a fake "VM sandbox" — it only
// decodes what is mathematically decodable without executing the script:
//   - Luraph _LPH_SRC hex payload
//   - string.char(...) byte arrays
//   - \ddd / \xNN escapes
//   - base64 tables (WeAreDevs / Prometheus)
//   - URL / webhook extraction
// The FULL dump (running proven engines) happens on the backend.

import {
  unescapeLuaString,
  hexToStr,
  isReadableText,
  base64Decode,
} from './decode';
import { ConstantEntry, HttpLogEntry } from '../types';

function decodeByteArrays(code: string): { decoded: string; count: number } {
  let decoded = code;
  let count = 0;
  const re = /string\.char\s*\(\s*([0-9,\s]+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const nums = m[1]
      .split(',')
      .map((n) => parseInt(n.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    if (nums.length < 3 || nums.length > 200000) continue;
    try {
      const text = String.fromCharCode(...nums);
      decoded = decoded.replace(m[0], JSON.stringify(text));
      count++;
    } catch {
      // skip oversized chunks
    }
  }
  return { decoded, count };
}

function extractConstants(code: string): ConstantEntry[] {
  const occurrences = new Map<string, number>();
  const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const raw = m[1] ?? m[2] ?? '';
    if (!raw) continue;
    let val: string;
    try {
      val = unescapeLuaString(raw);
    } catch {
      val = raw;
    }
    if (!val || val.length < 1 || val.length > 5000) continue;
    occurrences.set(val, (occurrences.get(val) || 0) + 1);
  }
  const constants: ConstantEntry[] = [];
  let id = 0;
  for (const [val, occ] of occurrences) {
    let type: ConstantEntry['type'] = 'string';
    if (/^https?:\/\//i.test(val)) type = 'url';
    else if (/rbxasset/i.test(val)) type = 'asset_id';
    else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(val)) type = 'identifier';
    constants.push({
      id: `const_${++id}`,
      type,
      value: val,
      occurrences: occ,
      isSensitive: /token|key|password|secret|webhook|authorization|bearer/i.test(val) || type === 'url',
    });
  }
  constants.sort((a, b) => b.occurrences - a.occurrences);
  return constants.slice(0, 500);
}

function extractHttpLogs(code: string): HttpLogEntry[] {
  const logs: HttpLogEntry[] = [];
  const seen = new Set<string>();
  const re = /(https?:\/\/[^\s"'`\)]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const url = m[1];
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const isWebhook = url.includes('discord.com/api/webhooks');
    logs.push({
      id: `http_${logs.length + 1}`,
      url,
      method: isWebhook ? 'POST' : 'GET',
      timestamp: new Date().toLocaleTimeString('id-ID'),
      interceptedType: isWebhook
        ? 'Webhook'
        : url.includes('raw.githubusercontent')
          ? 'HttpGet'
          : 'request',
    });
  }
  return logs;
}

/** Run honest static analysis. Never claims to run a VM. */
export function runStaticAnalysis(
  sourceCode: string,
  engineName: string
): {
  deobfuscatedCode: string;
  httpLogs: HttpLogEntry[];
  constants: ConstantEntry[];
  payloadExtracted: boolean;
} {
  const code = String(sourceCode || '');
  const httpLogs = extractHttpLogs(code);
  const constants = extractConstants(code);

  const parts: string[] = [];
  let payloadExtracted = false;

  // 1. Luraph _LPH_SRC hex payload
  const lph = code.match(/_LPH_SRC\s*=\s*["']([0-9a-fA-F]+)["']/);
  if (lph && lph[1].length >= 20) {
    const decoded = hexToStr(lph[1]);
    if (isReadableText(decoded)) {
      parts.push(`-- [Hasil decode _LPH_SRC (Luraph) — source asli sebelum dijalankan]\n${decoded}`);
      payloadExtracted = true;
    }
  }

  // 2. Decode \ddd + \xNN escapes across the whole text
  const escaped = code
    .replace(/\\(\d{3})/g, (_, d: string) => String.fromCharCode(parseInt(d, 10)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));

  // 3. Byte arrays
  const { decoded: byteDecoded, count } = decodeByteArrays(escaped);
  if (count > 0) {
    parts.push(`-- [Hasil decode string.char (${count} blok byte)]\n${byteDecoded}`);
    payloadExtracted = true;
  }

  // 4. Base64 tables
  const b64Blocks: string[] = [];
  const b64Seen = new Set<string>();
  const b64Re = /["']([A-Za-z0-9+/]{40,}={0,2})["']/g;
  let bm: RegExpExecArray | null;
  while ((bm = b64Re.exec(code)) !== null) {
    const decoded = base64Decode(bm[1]);
    if (decoded && isReadableText(decoded) && !b64Seen.has(decoded)) {
      b64Seen.add(decoded);
      b64Blocks.push(decoded);
    }
  }
  if (b64Blocks.length > 0) {
    parts.push(
      `-- [Hasil decode tabel Base64 (${b64Blocks.length} blok)]\n` +
        b64Blocks.map((b) => `-- BLOCK:\n${b}`).join('\n\n')
    );
    payloadExtracted = true;
  }

  // 5. loadstring hook point (static note)
  const lsMatch = code.match(/loadstring\s*\(\s*([^)]+)\s*\)/i);
  if (lsMatch) {
    parts.push(`-- [Pemanggilan loadstring: ${lsMatch[1]}]`);
  }

  const deobfuscatedCode =
    parts.length > 0
      ? parts.join('\n\n')
      : `-- [Analisis statis (browser) — ${engineName}]\n` +
        '-- Tidak ada blok hex/byte/base64 yang bisa didecode tanpa menjalankan script.\n' +
        '-- Untuk hasil penuh, pastikan backend aktif (mendukung Luraph/Moonveil/Prometheus).\n\n' +
        code;

  return { deobfuscatedCode, httpLogs, constants, payloadExtracted };
}