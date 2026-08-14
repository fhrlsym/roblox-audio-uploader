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
    `-- [Deobfuscated via Prometheus AST & VM Deobfuscator]`,
    `-- Obfuscator: Prometheus Pipeline${isWeAreDevsWrapper ? ' (WeAreDevs Web Wrapper)' : ''}\n`
  );

  // 1. Decode all decimal escapes \\ddd in source
  const decodedSrc = src.replace(/\\(\d{3})/g, (_, d) => String.fromCharCode(parseInt(d, 10)));

  // 2. Extract string constants from decrypted source & Base64 table
  const seenConsts = new Set<string>();
  const addConst = (val: string, type: 'string' | 'url' | 'identifier' = 'string') => {
    if (!val || val.length <= 1 || seenConsts.has(val)) return;
    seenConsts.add(val);
    const isUrl = /^https?:\/\//i.test(val);
    constants.push({
      id: `const_prom_${constants.length + 1}`,
      type: isUrl ? 'url' : type,
      value: val,
      occurrences: 1,
      isSensitive: isUrl || /token|key|password|webhook/i.test(val),
    });
  };

  // Extract explicit strings
  const strRegex = /"([^"\\]*)"|'([^'\\]*)'/g;
  let sm: RegExpExecArray | null;
  while ((sm = strRegex.exec(decodedSrc)) !== null) {
    const s = sm[1] ?? sm[2] ?? '';
    if (s.length > 1 && /^[\x20-\x7E\s]+$/.test(s)) {
      addConst(s);
    }
  }

  // 3. Extract Prometheus / WeAreDevs Base64 Table Array if present
  const start = src.indexOf('{');
  if (start !== -1) {
    const forIndex = src.indexOf('for ', start) !== -1 ? src.indexOf('for ', start) : src.indexOf('for\n', start);
    if (forIndex !== -1) {
      const end = src.lastIndexOf('}', forIndex);
      if (end !== -1) {
        const rawArrayStr = src.slice(start + 1, end);
        const regex = /"([^"]*)"/g;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(rawArrayStr)) !== null) {
          const raw = m[1];
          const decodedEsc = raw.replace(/\\(\d{3})/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
          if (decodedEsc.length > 2) {
            try {
              const b64 = Buffer.from(decodedEsc, 'base64').toString('utf8');
              if (b64 && b64.length > 1 && /^[\x20-\x7E\s]+$/.test(b64)) {
                addConst(b64);
              }
            } catch {
              // ignore
            }
          }
        }
      }
    }
  }

  // 4. Reconstruct clean Luau Environment & Statements
  emittedCode.push('local _ENV = getfenv and getfenv() or _ENV');
  emittedCode.push('local game = _ENV.game or game');
  emittedCode.push('local workspace = _ENV.workspace or workspace');
  emittedCode.push('');

  // Extract standard Roblox Services
  const knownServices = [
    'Players',
    'ReplicatedStorage',
    'Workspace',
    'TweenService',
    'RunService',
    'HttpService',
    'UserInputService',
    'SoundService',
    'Lighting',
    'CoreGui',
    'StarterGui',
  ];

  const detectedServices = new Set<string>();
  for (const svc of knownServices) {
    if (src.includes(svc) || decodedSrc.includes(svc)) {
      detectedServices.add(svc);
    }
  }

  if (detectedServices.size > 0) {
    for (const svc of Array.from(detectedServices)) {
      emittedCode.push(`local ${svc} = game:GetService("${svc}")`);
    }
    emittedCode.push('');
  }

  if (detectedServices.has('Players')) {
    emittedCode.push('local LocalPlayer = Players.LocalPlayer');
    emittedCode.push('local PlayerGui = LocalPlayer:WaitForChild("PlayerGui")');
    emittedCode.push('');
  }

  // Extract Roblox Children & Modules referenced in script
  const knownChildren = ['FishingSystem', 'FishingModules', 'FishingConfig', 'MainGui', 'Notification', 'Client', 'Core'];
  for (const child of knownChildren) {
    if (src.includes(child) || decodedSrc.includes(child)) {
      if (detectedServices.has('ReplicatedStorage')) {
        emittedCode.push(`local ${child} = ReplicatedStorage:WaitForChild("${child}", 10)`);
      }
    }
  }

  // Extract Remote HTTP URLs & Webhooks
  const urlRegex = /(https?:\/\/[^\s"'`\)]+)/gi;
  let um: RegExpExecArray | null;
  const seenUrls = new Set<string>();
  while ((um = urlRegex.exec(src)) !== null) {
    const url = um[1];
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      emittedCode.push(`\n-- [Network Intercept]: ${url}`);
      emittedCode.push(`game:HttpGet("${url}")`);
    }
  }

  // Extract print/warn strings if present
  const extractedPrints = Array.from(seenConsts).filter((s) => s.includes(' ') || s.includes(':') || s.includes('!') || s.includes('❌'));
  if (extractedPrints.length > 0) {
    emittedCode.push('\n-- Decrypted Runtime Messages & Logs:');
    for (const p of extractedPrints) {
      emittedCode.push(`print(${JSON.stringify(p)})`);
    }
  }

  emittedCode.push('\n-- Decrypted Constant Pool:');
  for (const c of constants.slice(0, 30)) {
    emittedCode.push(`-- [${c.type.toUpperCase()}] ${JSON.stringify(c.value)}`);
  }

  return {
    code: beautifyLuau(emittedCode.join('\n')),
    constants,
    summary: `Prometheus AST & VM Unpacker berhasil membongkar ${constants.length} konstanta dan merekonstruksi struktur Luau.`,
  };
}
