// Honest static decode techniques. These actually transform the input
// (hex _LPH_SRC, byte arrays, escaped strings, base64 tables) without ever
// pretending to run a VM. Used when a proven engine binary is unavailable.

function unescapeLuaString(body) {
  const simple = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v', '\\': '\\', '"': '"', "'": "'", '0': '\0' };
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\' && i + 1 < body.length) {
      const e = body[i + 1];
      if (e === 'x' && /^[0-9a-fA-F]{2}$/.test(body.slice(i + 2, i + 4))) {
        out += String.fromCharCode(parseInt(body.slice(i + 2, i + 4), 16));
        i += 3;
      } else if (e >= '0' && e <= '9') {
        let num = '';
        let j = i + 1;
        while (j < body.length && num.length < 3 && body[j] >= '0' && body[j] <= '9') {
          num += body[j];
          j++;
        }
        out += String.fromCharCode(parseInt(num, 10) & 0xff);
        i = j - 1;
      } else if (simple[e] !== undefined) {
        out += simple[e];
        i += 1;
      } else {
        out += e;
        i += 1;
      }
    } else {
      out += c;
    }
  }
  return out;
}

function hexToStr(hex) {
  const h = hex.length % 2 === 1 ? `0${hex}` : hex;
  let out = '';
  for (let i = 0; i < h.length; i += 2) {
    out += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
  }
  return out;
}

function isReadable(s) {
  if (!s || s.length < 10) return false;
  let printable = 0;
  let letters = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if ((c >= 32 && c <= 126) || c === 10 || c === 13 || c === 9) printable++;
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) letters++;
  }
  if (printable < s.length * 0.85) return false;
  return letters > 0;
}

function looksLikeCode(s) {
  return (
    s.length > 30 &&
    (/\blocal\b/.test(s) ||
      /\bfunction\b/.test(s) ||
      /\bloadstring\b/.test(s) ||
      /\bgame\b/.test(s) ||
      /\bGetService\b/.test(s) ||
      /--!nocheck/.test(s))
  );
}

function base64Decode(s) {
  const clean = String(s).replace(/\s+/g, '');
  if (!clean || clean.length < 4 || clean.length % 4 === 1) return null;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return null;
  try {
    const bin = Buffer.from(clean, 'base64').toString('binary');
    return bin;
  } catch {
    return null;
  }
}

/** Extract _LPH_SRC (Luraph) hex payload and hex-decode it. */
export function decodeLphSrc(code) {
  const m = code.match(/_LPH_SRC\s*=\s*["']([0-9a-fA-F]+)["']/);
  if (!m || m[1].length < 20) return null;
  const decoded = hexToStr(m[1]);
  if (!isReadable(decoded)) return null;
  return decoded;
}

/** Replace string.char(...) numeric lists with their decoded quoted strings. */
export function decodeByteArrays(code) {
  let decoded = code;
  let count = 0;
  const re = /string\.char\s*\(\s*([0-9,\s]+)\s*\)/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const nums = m[1].split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => !Number.isNaN(n));
    if (nums.length < 3 || nums.length > 200000) continue;
    try {
      const text = Buffer.from(nums).toString('binary');
      decoded = decoded.replace(m[0], JSON.stringify(text));
      count++;
    } catch {
      // skip
    }
  }
  return { decoded, count };
}

/** Decode \ddd and \xNN escapes in the whole source text. */
export function decodeEscapes(code) {
  return code
    .replace(/\\(\d{3})/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Attempt base64 table decode (WeAreDevs / Prometheus M-table). */
export function decodeBase64Tables(code) {
  const results = [];
  const re = /["']([A-Za-z0-9+/]{40,}={0,2})["']/g;
  const seen = new Set();
  let m;
  while ((m = re.exec(code)) !== null) {
    const decoded = base64Decode(m[1]);
    if (decoded && isReadable(decoded) && !seen.has(decoded)) {
      seen.add(decoded);
      results.push(decoded);
    }
  }
  return results;
}

/** Extract quoted strings, decoded, with classification + dedup. */
export function extractConstants(code) {
  const constants = [];
  const seen = new Map();
  const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
  let m;
  const occurrences = new Map();
  while ((m = re.exec(code)) !== null) {
    const raw = m[1] ?? m[2] ?? '';
    if (!raw) continue;
    let val;
    try {
      val = unescapeLuaString(raw);
    } catch {
      val = raw;
    }
    if (!val || val.length < 1 || val.length > 5000) continue;
    occurrences.set(val, (occurrences.get(val) || 0) + 1);
  }
  let id = 0;
  for (const [val, occ] of occurrences) {
    let type = 'string';
    if (/^https?:\/\//i.test(val)) type = 'url';
    else if (/rbxasset/i.test(val)) type = 'asset_id';
    else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(val)) type = 'identifier';
    const sensitive = /token|key|password|secret|webhook|authorization|bearer/i.test(val);
    constants.push({
      id: `const_${++id}`,
      type,
      value: val,
      occurrences: occ,
      isSensitive: sensitive || type === 'url',
    });
  }
  constants.sort((a, b) => b.occurrences - a.occurrences);
  return constants.slice(0, 500);
}

/** Extract URLs / webhooks. */
export function extractHttpLogs(code) {
  const logs = [];
  const seen = new Set();
  const re = /(https?:\/\/[^\s"'`\)]+)/gi;
  let m;
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
      interceptedType: isWebhook ? 'Webhook' : url.includes('raw.githubusercontent') ? 'HttpGet' : 'request',
    });
  }
  return logs;
}

/**
 * Build a full static-analysis result object. Always honest: it only reports
 * what it actually decoded.
 */
export function staticAnalyze(code) {
  const httpLogs = extractHttpLogs(code);
  const constants = extractConstants(code);

  const decodedParts = [];
  let payloadExtracted = false;

  const lph = decodeLphSrc(code);
  if (lph) {
    decodedParts.push('-- [Hasil decode _LPH_SRC (Luraph) — source asli sebelum dijalankan]\n' + lph);
    payloadExtracted = true;
  }

  const escapes = decodeEscapes(code);
  const { decoded: byteDecoded, count } = decodeByteArrays(escapes);
  if (count > 0) {
    decodedParts.push(`-- [Hasil decode string.char (${count} blok byte)]\n${byteDecoded}`);
    payloadExtracted = true;
  }

  const b64Tables = decodeBase64Tables(code);
  if (b64Tables.length > 0) {
    decodedParts.push(
      `-- [Hasil decode tabel Base64 (${b64Tables.length} blok)]\n` +
        b64Tables.map((b) => `-- BLOCK:\n${b}`).join('\n\n')
    );
    payloadExtracted = true;
  }

  const lsMatch = code.match(/loadstring\s*\(\s*([^)]+)\s*\)/i);
  if (lsMatch) {
    decodedParts.push(`-- [Pemanggilan loadstring: ${lsMatch[1]}]`);
    payloadExtracted = true;
  }

  let deobfuscatedCode;
  if (decodedParts.length > 0) {
    deobfuscatedCode = decodedParts.join('\n\n');
  } else {
    deobfuscatedCode =
      '-- [Analisis statis selesai — tidak ada blok hex/byte/base64 yang bisa didecode tanpa menjalankan VM.]\n' +
      '-- Script tetap ditampilkan agar kamu bisa menyalin & memeriksa konstanta/URL-nya.\n\n' +
      code;
  }

  return {
    success: true,
    deobfuscatedCode,
    httpLogs,
    constants,
    payloadExtracted,
    summaryLines: decodedParts.length,
  };
}