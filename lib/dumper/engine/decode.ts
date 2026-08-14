// Core string / byte decoding utilities shared by all dump engines.
// Pure JS/TS — no native runtime required.

export interface ByteConst {
  id: string;
  type: 'string' | 'number' | 'boolean' | 'url' | 'identifier' | 'asset_id';
  value: string;
  raw?: string;
  occurrences: number;
  isSensitive?: boolean;
}

const SIMPLE_ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  a: '\x07',
  b: '\b',
  f: '\f',
  v: '\v',
  '\\': '\\',
  '"': '"',
  "'": "'",
  '0': '\0',
};

/** Decode the body of a Lua string literal (content between matching quotes). */
export function unescapeLuaString(body: string): string {
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
      } else if (SIMPLE_ESCAPES[e] !== undefined) {
        out += SIMPLE_ESCAPES[e];
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

/** Replace all \ddd decimal escapes across raw source text. */
export function decodeDecimalEscapes(src: string): string {
  return src.replace(/\\(\d{3})/g, (_, d: string) => String.fromCharCode(parseInt(d, 10)));
}

/** Decode \xNN escapes across raw source text. */
export function decodeHexEscapes(src: string): string {
  return src.replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** Convert an even-length hex string to raw text. */
export function hexToStr(hex: string): string {
  const h = hex.length % 2 === 1 ? `0${hex}` : hex;
  let out = '';
  for (let i = 0; i < h.length; i += 2) {
    out += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
  }
  return out;
}

/** Convert raw text to lowercase hex. */
export function strToHex(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    out += s.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return out;
}

export function bytesToStr(bytes: number[]): string {
  return bytes.map((b) => String.fromCharCode(b & 0xff)).join('');
}

export function strToBytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
  return out;
}

export function xorRepeatBytes(cipher: number[], key: number[]): number[] {
  if (!key.length) return cipher;
  return cipher.map((b, i) => b ^ key[i % key.length]);
}

/** Heuristic: is the byte blob human-readable text? */
export function isPrintableBlob(bytes: number[], minLen = 3): boolean {
  if (bytes.length < minLen) return false;
  if (!bytes.every((b) => b >= 32 && b <= 126)) return false;
  const letters = bytes.filter((b) => (b >= 65 && b <= 90) || (b >= 97 && b <= 122)).length;
  return letters > 0;
}

/** Heuristic: is the string printable, readable text? */
export function isReadableText(s: string, minLen = 2): boolean {
  if (typeof s !== 'string' || s.length < minLen) return false;
  let printable = 0;
  let letters = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if ((c >= 32 && c <= 126) || c === 10 || c === 13 || c === 9) printable++;
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) letters++;
  }
  if (printable < s.length * 0.85) return false;
  if (letters === 0) return false;
  return letters * 2 >= Math.min(s.length, 200);
}

/** Base64 decode → string, or null if invalid/not decodable. */
export function base64Decode(s: string): string | null {
  const clean = s.replace(/\s+/g, '');
  if (!clean || clean.length < 4 || clean.length % 4 === 1) return null;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return null;
  try {
    const bin = atob(clean);
    return bin;
  } catch {
    return null;
  }
}

/** Score a candidate decoded string as Lua source. */
export function looksLikeCode(s: string): boolean {
  if (!s || s.length < 30) return false;
  const tokens =
    /\blocal\b/.test(s) ||
    /\bfunction\b/.test(s) ||
    /\bloadstring\b/.test(s) ||
    /\bgame\b/.test(s) ||
    /\bworkspace\b/.test(s) ||
    /\bGetService\b/.test(s) ||
    /--!nocheck/.test(s) ||
    /\brepeat\b.*\buntil\b/.test(s);
  return tokens;
}

/** Best-effort classification of a discovered string constant. */
export function classifyValue(value: string): 'url' | 'asset_id' | 'string' {
  if (/^https?:\/\//i.test(value)) return 'url';
  if (/^rbxassetid?:\/\//i.test(value) || /^\d{6,}$/.test(value.trim()) && /rbxassetid/.test('')) return 'asset_id';
  if (/rbxasset/i.test(value)) return 'asset_id';
  return 'string';
}

export function isSensitiveValue(value: string): boolean {
  return (
    /^https?:\/\//i.test(value) ||
    /token|key|password|secret|webhook|authorization|bearer/i.test(value)
  );
}
