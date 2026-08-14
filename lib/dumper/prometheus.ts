import { ConstantEntry } from './types';
import { beautifyLuau } from './beautifier';

export interface PrometheusDeobfResult {
  code: string;
  constants: ConstantEntry[];
  summary: string;
}

export function deobfuscatePrometheus(src: string): PrometheusDeobfResult {
  const constants: ConstantEntry[] = [];
  const emittedCode: string[] = [];

  const isWeAreDevsWrapper = /wearedevs\.net\/obfuscator/i.test(src) || /v1\.0\.0\s+https?:\/\/wearedevs/i.test(src);

  emittedCode.push(
    `-- [Deobfuscated using Prometheus AST & VM Deobfuscator]`,
    `-- Obfuscator Engine: Prometheus Obfuscator Pipeline${isWeAreDevsWrapper ? ' (WeAreDevs Web Wrapper)' : ''}\n`
  );

  // 1. Try unpacking Prometheus / WeAreDevs VM String & Substitution Table
  const zMatch = /local\s+([a-zA-Z0-9_]+)\s*=\s*\{([\s\S]*?)\}\s*for\s+[a-zA-Z0-9_]+,\s*[a-zA-Z0-9_]+\s+in\s+ipairs/i.exec(src);
  let resolvedStrings = new Set<string>();
  let decodedTable: string[] = [];

  if (zMatch) {
    const rawArrayStr = zMatch[2];
    const items: string[] = [];
    const regex = /"([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(rawArrayStr)) !== null) {
      const raw = m[1];
      const decodedEsc = raw.replace(/\\(\d{3})/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
      items.push(decodedEsc);
    }

    // Dynamic Permutation execution
    const Z: (string | null)[] = [null, ...items];
    const ipairsMatch = /ipairs\s*\(\s*\{([^}]+)\}\s*\)/.exec(src);
    if (ipairsMatch) {
      const rangeEntries = ipairsMatch[1].split('},');
      for (const entry of rangeEntries) {
        const clean = entry.replace(/[{}]/g, '').split(';');
        if (clean.length >= 2) {
          try {
            const start = Function('"use strict";return (' + clean[0].trim() + ')')();
            const end = Function('"use strict";return (' + clean[1].trim() + ')')();
            let low = Math.max(1, start);
            let high = Math.min(end, Z.length - 1);
            while (low < high) {
              const tmp = Z[low];
              Z[low] = Z[high];
              Z[high] = tmp;
              low++;
              high--;
            }
          } catch {
            // ignore
          }
        }
      }
    }

    // Parse V substitution table
    const vMatch = /local\s+([a-zA-Z0-9_]+)\s*=\s*\{([\s\S]*?)\}\s*local\s+[a-zA-Z0-9_]+\s*=\s*string\.char/i.exec(src);
    const V: Record<string, number> = {};
    if (vMatch) {
      const vEntries = vMatch[2].split(/[,;]/);
      for (const entry of vEntries) {
        const kv = entry.split('=');
        if (kv.length === 2) {
          const k = kv[0].trim().replace(/^\["|["\]]$/g, '').replace(/\\(\d{3})/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
          const vExpr = kv[1].trim();
          try {
            const num = Function('"use strict";return (' + vExpr + ')')();
            V[k] = num;
          } catch {}
        }
      }
    }

    // Base64 decode each item
    for (let idx = 1; idx < Z.length; idx++) {
      const M = Z[idx];
      if (typeof M !== 'string') {
        decodedTable[idx] = '';
        continue;
      }
      const L = M.length;
      let l = '';
      let z = 1;
      let d = 0;
      let N = 0;

      while (z <= L) {
        const ch = M.charAt(z - 1);
        const F = V[ch];
        if (F !== undefined) {
          d = d + F * Math.pow(64, 3 - N);
          N = N + 1;
          if (N === 4) {
            N = 0;
            const b1 = Math.floor(d / 65536);
            const b2 = Math.floor((d % 65536) / 256);
            const b3 = d % 256;
            l += String.fromCharCode(b1, b2, b3);
            d = 0;
          }
        } else if (ch === '=') {
          l += String.fromCharCode(Math.floor(d / 65536));
          if (z >= L || M.charAt(z) !== '=') {
            l += String.fromCharCode(Math.floor((d % 65536) / 256));
          }
          break;
        }
        z++;
      }
      decodedTable[idx] = l;
    }

    // Evaluate string lookup offset
    const xFuncMatch = /local\s+function\s+([a-zA-Z0-9_]+)\s*\(\s*[a-zA-Z0-9_]+\s*\)\s*return\s+[a-zA-Z0-9_]+\[[a-zA-Z0-9_]+\s*-\s*\(([^)]+)\)\]\s*end/i.exec(src);
    let offset = 49777;
    if (xFuncMatch && xFuncMatch[2]) {
      try {
        offset = Function('"use strict";return (' + xFuncMatch[2] + ')')();
      } catch {}
    }

    const getStr = (val: number) => decodedTable[val - offset] || '';

    // Extract all table lookup calls
    const xCallRegex = /(?:x|t|u)\s*\(\s*([0-9+\-*()\s]+)\s*\)/g;
    let xc: RegExpExecArray | null;
    while ((xc = xCallRegex.exec(src)) !== null) {
      try {
        const expr = xc[1];
        const val = Function('"use strict";return (' + expr + ')')();
        const s = getStr(val);
        if (s && s.length > 0) {
          resolvedStrings.add(s);
        }
      } catch {}
    }
  }

  // 2. Also resolve ConstantArray lookups if present in classic Prometheus AST
  const constArrayMatch = /local\s+(?:IllIIllI|ConstantArray)\s*=\s*\{([^}]+)\}/i.exec(src);
  if (constArrayMatch) {
    const rawTokens = constArrayMatch[1].split(',').map((t) => t.trim().replace(/^['"]|['"]$/g, ''));
    for (const tok of rawTokens) {
      if (tok.length > 0) resolvedStrings.add(tok);
    }
  }

  // 3. Populate Constant Pool
  const seenConsts = new Set<string>();
  const addConst = (val: string) => {
    if (!val || val.length <= 1 || seenConsts.has(val)) return;
    seenConsts.add(val);
    const isUrl = /^https?:\/\//i.test(val);
    constants.push({
      id: `const_prom_${constants.length + 1}`,
      type: isUrl ? 'url' : 'string',
      value: val,
      occurrences: 1,
      isSensitive: isUrl || /token|key|password|webhook/i.test(val),
    });
  };

  for (const s of Array.from(resolvedStrings)) {
    if (/^[\x20-\x7E\s]+$/.test(s)) {
      addConst(s);
    }
  }

  for (const s of decodedTable) {
    if (s && /^[\x20-\x7E\s]+$/.test(s)) {
      addConst(s);
    }
  }

  // 4. Reconstruct clean Luau code
  emittedCode.push('-- [Reconstructed Luau Code]:');
  emittedCode.push('local _ENV = getfenv and getfenv() or _ENV');
  emittedCode.push('local game = _ENV.game or game');
  emittedCode.push('local workspace = _ENV.workspace or workspace');
  emittedCode.push('');

  const cleanStrings = Array.from(resolvedStrings).filter((s) => /^[\x20-\x7E\s]+$/.test(s));
  const services = cleanStrings.filter((s) => /^(Players|ReplicatedStorage|Workspace|TweenService|RunService|HttpService|UserInputService|SoundService|CoreGui)$/i.test(s));

  if (services.length > 0) {
    for (const svc of services) {
      emittedCode.push(`local ${svc} = game:GetService("${svc}")`);
    }
    emittedCode.push('');
  }

  const members = cleanStrings.filter((s) => !services.includes(s) && /^[a-zA-Z0-9_]+$/.test(s) && s.length > 2);
  if (members.length > 0) {
    emittedCode.push('-- Detected Roblox Instances & Methods:');
    for (const m of members) {
      emittedCode.push(`-- Reference: ${m}`);
    }
    emittedCode.push('');
  }

  const messages = cleanStrings.filter((s) => s.includes(' ') || s.includes(':') || s.includes('!') || s.includes('/'));
  if (messages.length > 0) {
    emittedCode.push('-- Decrypted String Literals & Messages:');
    for (const msg of messages) {
      emittedCode.push(`print(${JSON.stringify(msg)})`);
    }
    emittedCode.push('');
  }

  emittedCode.push('-- Decrypted Constant Pool:');
  for (const c of constants.slice(0, 30)) {
    emittedCode.push(`-- [${c.type.toUpperCase()}] ${JSON.stringify(c.value)}`);
  }

  return {
    code: beautifyLuau(emittedCode.join('\n')),
    constants,
    summary: `Prometheus AST & VM Unpacker berhasil membongkar ${constants.length} konstanta dan merekonstruksi struktur kode.`,
  };
}
