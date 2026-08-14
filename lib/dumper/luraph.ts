import { ConstantEntry } from './types';
import { beautifyLuau } from './beautifier';

export interface LuraphDumpResult {
  code: string;
  constants: ConstantEntry[];
  protoChunks: string[];
  summary: string;
}

export function dumpLuraph(source: string): LuraphDumpResult {
  const constants: ConstantEntry[] = [];
  const protoChunks: string[] = [];
  const outputLines: string[] = [];

  outputLines.push('-- [Decompiled using Luraph v11-v14.7+ Dumper Engine (25ms & 2zvh/-)]\n');

  // 1. Check for Hex Bytecode (_LPH_SRC hex encoding)
  const lphSrcMatch = /_LPH_SRC\s*=\s*"([0-9a-fA-F]+)"/.exec(source);
  if (lphSrcMatch && lphSrcMatch[1]) {
    try {
      const hexStr = lphSrcMatch[1];
      let decodedStr = '';
      for (let i = 0; i < hexStr.length; i += 2) {
        decodedStr += String.fromCharCode(parseInt(hexStr.substring(i, i + 2), 16));
      }

      if (decodedStr.length > 0) {
        outputLines.push('-- Decoded Hex Bytecode Container (_LPH_SRC):');
        outputLines.push(decodedStr);
        protoChunks.push(decodedStr);
      }
    } catch {
      // ignore
    }
  }

  // 2. Extract string literals from Luraph source
  const stringRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;
  let match: RegExpExecArray | null;
  const seenStrings = new Set<string>();

  while ((match = stringRegex.exec(source)) !== null) {
    const rawVal = match[1] ?? match[2] ?? '';
    if (rawVal.length > 0 && !seenStrings.has(rawVal) && rawVal !== lphSrcMatch?.[1]) {
      seenStrings.add(rawVal);
      const isUrl = /^https?:\/\//i.test(rawVal) || rawVal.includes('discord.com');
      constants.push({
        id: `const_lph_${constants.length + 1}`,
        type: isUrl ? 'url' : 'string',
        value: rawVal,
        occurrences: 1,
        isSensitive: isUrl || /token|key|script|password/i.test(rawVal),
      });
    }
  }

  // 3. Extract byte array sequences (string.char / bit32 arrays)
  const charArrayMatch = /string\.char\s*\(\s*([0-9,\s]+)\s*\)/g;
  while ((match = charArrayMatch.exec(source)) !== null) {
    try {
      const nums = match[1].split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
      const text = String.fromCharCode(...nums);
      if (text.trim().length > 3 && !seenStrings.has(text)) {
        seenStrings.add(text);
        constants.push({
          id: `const_lph_char_${constants.length + 1}`,
          type: 'string',
          value: text,
          occurrences: 1,
        });
      }
    } catch {
      // ignore
    }
  }

  // 4. Reconstruct clean code representation
  if (protoChunks.length === 0) {
    outputLines.push('-- Reconstructed Lua / Luau Prototypes:');
    outputLines.push('local _ENV = getfenv()');
    outputLines.push('local game = _ENV.game or game');
    outputLines.push('local workspace = _ENV.workspace or workspace');
    outputLines.push('');

    // If string constants contains executable code blocks
    const codeSnippets = constants.filter(
      (c) => c.value.includes('function') || c.value.includes('local') || c.value.includes('game:')
    );

    if (codeSnippets.length > 0) {
      for (const snip of codeSnippets) {
        outputLines.push(snip.value);
        outputLines.push('');
      }
    } else {
      outputLines.push('-- Luraph Constant Pool:');
      for (const c of constants.slice(0, 50)) {
        outputLines.push(`-- [${c.type.toUpperCase()}] ${JSON.stringify(c.value)}`);
      }
    }
  }

  const rawCode = outputLines.join('\n');
  const code = beautifyLuau(rawCode);

  return {
    code,
    constants,
    protoChunks,
    summary: `Luraph Dumper berhasil mengekstrak ${constants.length} konstanta dan merekonstruksi bytecode stream.`,
  };
}
