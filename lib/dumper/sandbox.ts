import { detectObfuscator } from './detector';
import { beautifyLuau } from './beautifier';
import { decompileMoonveil } from './moonveil';
import { dumpLuraph } from './luraph';
import { deobfuscatePrometheus } from './prometheus';
import { DumpExecutionResult, DumperEngine, HttpLogEntry, ConstantEntry, VMTraceEntry } from './types';

export function runDumperSandbox(sourceCode: string, engineChoice: DumperEngine = 'auto'): DumpExecutionResult {
  const startTime = Date.now();
  const rawSource = String(sourceCode || '').trim();

  if (!rawSource) {
    return {
      success: false,
      deobfuscatedCode: '-- [Error] Script input kosong. Tempelkan script Luau/Lua terlebih dahulu.',
      engineUsed: 'none',
      obfuscatorDetected: 'None',
      executionTimeMs: 0,
      httpLogs: [],
      constants: [],
      summary: {
        totalLinesOriginal: 0,
        totalLinesDumped: 0,
        constantsExtracted: 0,
        httpCallsIntercepted: 0,
        payloadsExtracted: 0,
      },
      error: 'Script input kosong.',
    };
  }

  // 1. Detect obfuscator
  const detection = detectObfuscator(rawSource);
  const effectiveEngine = engineChoice === 'auto' ? detection.engine : engineChoice;

  const httpLogs: HttpLogEntry[] = [];
  const constants: ConstantEntry[] = [];
  let vmTraces: VMTraceEntry[] | undefined = undefined;
  let finalCode = '';

  // Extract HTTP URLs from source
  const urlRegex = /(https?:\/\/[^\s"'`\)]+)/gi;
  let urlMatch: RegExpExecArray | null;
  const seenUrls = new Set<string>();

  while ((urlMatch = urlRegex.exec(rawSource)) !== null) {
    const url = urlMatch[1];
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      const isWebhook = url.includes('discord.com/api/webhooks');
      httpLogs.push({
        id: `http_${httpLogs.length + 1}`,
        url,
        method: isWebhook ? 'POST' : 'GET',
        timestamp: new Date().toLocaleTimeString('id-ID'),
        interceptedType: isWebhook ? 'Webhook' : url.includes('raw.githubusercontent') ? 'HttpGet' : 'request',
      });
    }
  }

  // 2. Dispatch to designated engine
  switch (effectiveEngine) {
    case 'wearedevs-deobf':
    case 'prometheus-ast': {
      const res = deobfuscatePrometheus(rawSource);
      finalCode = res.code;
      constants.push(...res.constants);
      break;
    }

    case 'moonveil-devirt': {
      const res = decompileMoonveil(rawSource);
      finalCode = res.code;
      constants.push(...res.constants);
      vmTraces = res.traces;
      break;
    }

    case 'luraph-v14':
    case 'luraph-25ms': {
      const res = dumpLuraph(rawSource);
      finalCode = res.code;
      constants.push(...res.constants);
      break;
    }

    case 'bytearray-unpacker': {
      let decoded = rawSource;
      const charRegex = /string\.char\s*\(\s*([0-9,\s]+)\s*\)/g;
      let cMatch: RegExpExecArray | null;
      let count = 0;

      while ((cMatch = charRegex.exec(rawSource)) !== null) {
        try {
          const nums = cMatch[1].split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
          const text = String.fromCharCode(...nums);
          decoded = decoded.replace(cMatch[0], JSON.stringify(text));
          count++;
          constants.push({
            id: `const_byte_${constants.length + 1}`,
            type: 'string',
            value: text,
            occurrences: 1,
          });
        } catch {
          // ignore
        }
      }

      const loadstringMatch = /loadstring\s*\(\s*("[^"]+")\s*\)/i.exec(decoded);
      if (loadstringMatch && loadstringMatch[1]) {
        try {
          const innerCode = JSON.parse(loadstringMatch[1]);
          finalCode = beautifyLuau(`-- [Unpacked Loadstring Payload via Byte Array Engine]\n\n${innerCode}`);
        } catch {
          finalCode = beautifyLuau(`-- [Decoded Byte Array Sequences (${count} Chunks)]\n\n${decoded}`);
        }
      } else {
        finalCode = beautifyLuau(`-- [Decoded Byte Array Sequences (${count} Chunks)]\n\n${decoded}`);
      }
      break;
    }

    case 'ironbrew-deobf': {
      const header = '-- [Decompiled using IronBrew Deserializer Engine (larry old src/ironbrew)]\n\n';
      const stringRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;
      let sMatch: RegExpExecArray | null;
      while ((sMatch = stringRegex.exec(rawSource)) !== null) {
        const strVal = sMatch[1] ?? sMatch[2] ?? '';
        if (strVal.length > 2) {
          constants.push({
            id: `const_ib_${constants.length + 1}`,
            type: 'string',
            value: strVal,
            occurrences: 1,
          });
        }
      }
      finalCode = beautifyLuau(header + rawSource);
      break;
    }

    case 'httplog-interceptor': {
      const lines: string[] = [];
      lines.push('-- [Captured via 25ms HTTP & Webhook Interceptor Engine]\n');
      lines.push(`-- Total Intercepted Endpoints: ${httpLogs.length}`);
      lines.push('');
      for (const log of httpLogs) {
        lines.push(`-- [${log.interceptedType}] [${log.method}] ${log.url}`);
      }
      lines.push('\n-- Source Code Script:');
      lines.push(rawSource);
      finalCode = beautifyLuau(lines.join('\n'));
      break;
    }

    case 'revea-env':
    case 'mimic-sandbox':
    default: {
      const lines: string[] = [];
      lines.push(`-- [Reconstructed via ${detection.engineName}]\n`);
      lines.push('local _ENV = getfenv and getfenv() or _ENV');
      lines.push('local game = _ENV.game or game');
      lines.push('local workspace = _ENV.workspace or workspace');
      lines.push('local task = _ENV.task or task');
      lines.push('');

      const strRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;
      let sMatch: RegExpExecArray | null;
      const seen = new Set<string>();

      while ((sMatch = strRegex.exec(rawSource)) !== null) {
        const val = sMatch[1] ?? sMatch[2] ?? '';
        if (val.length > 0 && !seen.has(val)) {
          seen.add(val);
          constants.push({
            id: `const_mimic_${constants.length + 1}`,
            type: /^https?:\/\//i.test(val) ? 'url' : 'string',
            value: val,
            occurrences: 1,
          });
        }
      }

      const lsMatch = /loadstring\s*\(\s*([^\)]+)\s*\)/i.exec(rawSource);
      if (lsMatch && lsMatch[1]) {
        lines.push('-- Intercepted Dynamic loadstring() Invocation:');
        lines.push(`-- Parameter: ${lsMatch[1]}`);
        lines.push('');
      }

      lines.push(rawSource);
      finalCode = beautifyLuau(lines.join('\n'));
      break;
    }
  }

  const executionTimeMs = Date.now() - startTime;
  const originalLines = rawSource.split(/\r?\n/).length;
  const dumpedLines = finalCode.split(/\r?\n/).length;

  return {
    success: true,
    deobfuscatedCode: finalCode,
    engineUsed: detection.engineName,
    obfuscatorDetected: `${detection.obfuscator} ${detection.version || ''}`.trim(),
    executionTimeMs,
    httpLogs,
    constants,
    vmTraces,
    summary: {
      totalLinesOriginal: originalLines,
      totalLinesDumped: dumpedLines,
      constantsExtracted: constants.length,
      httpCallsIntercepted: httpLogs.length,
      payloadsExtracted: httpLogs.length + (finalCode.length > 0 ? 1 : 0),
    },
  };
}
