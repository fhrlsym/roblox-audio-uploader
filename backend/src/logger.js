/**
 * In-memory ring-buffer logger.
 *
 * Captures console output (log/info/warn/error) plus explicit log() calls so the
 * Developer Panel can stream recent backend activity without shell access.
 * Buffer is intentionally bounded — this is for debugging, not persistence.
 */

const MAX_ENTRIES = 500;

const entries = [];
let nextId = 1;

// Prevent re-entrancy when our own console wrapper itself logs.
let patched = false;
let emitting = false;

function push(level, args) {
  const message = args
    .map((a) => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join(' ');

  entries.push({
    id: nextId++,
    level,
    message,
    timestamp: new Date().toISOString(),
  });

  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
}

export function log(level, ...args) {
  push(level, args);
}

export const logger = {
  info: (...args) => push('info', args),
  warn: (...args) => push('warn', args),
  error: (...args) => push('error', args),
};

export function getLogs({ since = 0, limit = 200, level } = {}) {
  let out = entries.filter((e) => e.id > since);
  if (level && level !== 'all') out = out.filter((e) => e.level === level);
  if (out.length > limit) out = out.slice(out.length - limit);
  return out;
}

export function clearLogs() {
  entries.length = 0;
}

/**
 * Mirror console.* into the ring buffer while preserving default behaviour.
 * Safe to call multiple times.
 */
export function installConsoleCapture() {
  if (patched) return;
  patched = true;

  const levels = [
    ['log', 'info'],
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
  ];

  for (const [method, level] of levels) {
    const original = console[method].bind(console);
    console[method] = (...args) => {
      if (!emitting) {
        emitting = true;
        try {
          push(level, args);
        } finally {
          emitting = false;
        }
      }
      original(...args);
    };
  }
}
