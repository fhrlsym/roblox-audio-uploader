import { ConstantEntry } from './types';
import { beautifyLuau } from './beautifier';

export interface PrometheusDeobfResult {
  code: string;
  constants: ConstantEntry[];
  renamedIdentifiers: number;
  summary: string;
}

export function deobfuscatePrometheus(source: string): PrometheusDeobfResult {
  const constants: ConstantEntry[] = [];
  let code = source;

  // 1. Extract string literals
  const stringRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;
  let match: RegExpExecArray | null;
  const seenStrings = new Set<string>();

  while ((match = stringRegex.exec(source)) !== null) {
    const rawVal = match[1] ?? match[2] ?? '';
    if (rawVal.length > 0 && !seenStrings.has(rawVal)) {
      seenStrings.add(rawVal);
      const isUrl = /^https?:\/\//i.test(rawVal) || rawVal.includes('discord.com');
      constants.push({
        id: `const_prom_${constants.length + 1}`,
        type: isUrl ? 'url' : 'string',
        value: rawVal,
        occurrences: 1,
        isSensitive: isUrl || /token|key|password|auth/i.test(rawVal),
      });
    }
  }

  // 2. Identify and un-mangle Prometheus obfuscated identifiers (IllIIllI, etc.)
  const mangledVars = new Set<string>();
  const idRegex = /\b(I[lI1]{3,}|l[I1l]{3,}|_[0-9a-zA-Z_]{6,})\b/g;
  while ((match = idRegex.exec(source)) !== null) {
    mangledVars.add(match[1]);
  }

  let renameCounter = 1;
  const renameMap = new Map<string, string>();
  for (const mVar of Array.from(mangledVars)) {
    renameMap.set(mVar, `v_${renameCounter++}`);
  }

  for (const [oldName, newName] of renameMap.entries()) {
    const esc = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    code = code.replace(new RegExp(`\\b${esc}\\b`, 'g'), newName);
  }

  // 3. Resolve ConstantArray lookups if present
  // local ConstantArray = { "str1", "str2" ... } -> inline replacement
  const arrayMatch = /local\s+([a-zA-Z0-9_]+)\s*=\s*\{([^}]+)\}/.exec(code);
  if (arrayMatch && arrayMatch[2]) {
    const arrayName = arrayMatch[1];
    const rawItems = arrayMatch[2].split(',').map((s) => s.trim());
    for (let i = 0; i < rawItems.length; i++) {
      const itemVal = rawItems[i];
      if (itemVal) {
        const lookupPattern = new RegExp(`${arrayName}\\[${i + 1}\\]`, 'g');
        code = code.replace(lookupPattern, itemVal);
      }
    }
  }

  // Prepend deobfuscator header
  const header = '-- [Deobfuscated using Prometheus AST Unparser Engine (larry old src/Prometheus)]\n\n';
  const cleanCode = beautifyLuau(header + code);

  return {
    code: cleanCode,
    constants,
    renamedIdentifiers: renameMap.size,
    summary: `Prometheus AST Unparser berhasil me-rename ${renameMap.size} variabel teracak dan mengekstrak ${constants.length} konstanta.`,
  };
}
