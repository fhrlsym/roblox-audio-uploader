/**
 * Simple concurrency-limited queue for Roblox uploads.
 * Limits simultaneous calls to Roblox API to avoid throttling.
 * Concurrency default = 2, min spacing between starts = 1500ms.
 */

const MAX_CONCURRENCY = Number(process.env.ROBLOX_UPLOAD_CONCURRENCY) || 2;
const MIN_SPACING_MS = 1500;

const queue = [];
let active = 0;
let lastStartedAt = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getStats() {
  return { pending: queue.length, active, maxConcurrency: MAX_CONCURRENCY };
}

async function enqueue(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    process();
  });
}

async function process() {
  if (active >= MAX_CONCURRENCY) return;
  if (queue.length === 0) return;

  // Enforce minimum spacing between starts
  const now = Date.now();
  const wait = Math.max(0, lastStartedAt + MIN_SPACING_MS - now);
  if (wait > 0) {
    setTimeout(process, wait + 50);
    return;
  }

  const item = queue.shift();
  if (!item) return;

  active++;
  lastStartedAt = Date.now();

  try {
    const result = await item.task();
    item.resolve(result);
  } catch (err) {
    item.reject(err);
  } finally {
    active--;
    // Process next item
    setTimeout(process, 50);
  }
}

// Expose for /api/health
globalThis.__s2uploadQueue = {
  get pending() { return queue.length; },
  get active() { return active; },
  get maxConcurrency() { return MAX_CONCURRENCY; },
  getStats,
};

export { enqueue, getStats };
