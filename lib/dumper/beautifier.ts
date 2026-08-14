export function beautifyLuau(code: string): string {
  if (!code || typeof code !== 'string') return '';

  const raw = code.trim();
  if (!raw) return '';

  // Split lines and normalize endings
  const lines = raw.split(/\r?\n/);
  const formatted: string[] = [];
  let indentLevel = 0;

  const INDENT_STR = '    '; // 4 spaces

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (!line) {
      // Keep single empty line if previous line wasn't empty
      if (formatted.length > 0 && formatted[formatted.length - 1] !== '') {
        formatted.push('');
      }
      continue;
    }

    // Adjust indent down for block closing tokens on the current line
    const dedentCurrentLine =
      /^(end|until|else|elseif|\}|\))\b/i.test(line) ||
      /^(\]\]|\})/i.test(line);

    if (dedentCurrentLine && indentLevel > 0) {
      indentLevel--;
    }

    // Apply current indentation
    const prefix = INDENT_STR.repeat(Math.max(0, indentLevel));
    formatted.push(prefix + line);

    // Calculate indent changes for the NEXT line
    // Tokens that open a block
    const opensBlock =
      /\b(function\s*\(|function\s+[a-zA-Z0-9_:.]+\s*\(|then|do|repeat)\s*$/i.test(line) ||
      /\b(then|do)$/i.test(line) ||
      /\{\s*$/.test(line) ||
      /\(\s*$/.test(line);

    // Tokens that re-open a block (like else, elseif)
    const reopensBlock = /^(else|elseif)\b/i.test(line);

    if (opensBlock || reopensBlock) {
      indentLevel++;
    }
  }

  return formatted.join('\n');
}
