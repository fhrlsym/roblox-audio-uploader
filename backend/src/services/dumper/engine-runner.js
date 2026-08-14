// Orchestrates the PROVEN dump engines by spawning them as subprocesses
// (they run on the Railway container, which has python3 / luau / lune / lua5.3).
// Falls back to honest static analysis when a binary is unavailable.

import { spawn, spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { BACKEND_ROOT } from '../../config.js';
import { detectObfuscator, engineToDisplayName } from './detector.js';
import { staticAnalyze } from './static-decode.js';

const ENGINES_DIR = join(BACKEND_ROOT, 'engines');
const TMP_DIR = join(BACKEND_ROOT, 'temp_dump');
const MAX_INPUT_BYTES = 2 * 1024 * 1024; // 2MB
const ENGINE_TIMEOUT_MS = 90_000;

function resolveBinary(name, envVar) {
  if (envVar && existsSync(envVar)) return envVar;
  try {
    const res = spawnSync(name, ['--version'], { timeout: 5000, stdio: 'ignore' });
    if (!res.error && res.status === 0) return name;
  } catch {
    // ignore
  }
  return null;
}

export function availableBinaries() {
  return {
    python3: resolveBinary('python3', process.env.PYTHON_BIN),
    luau: resolveBinary(process.env.LUAU_BIN || 'luau', process.env.LUAU_BIN),
    lune: resolveBinary(process.env.LUNE_BIN || 'lune', process.env.LUNE_BIN),
    lua5_3: resolveBinary(process.env.LUA_BIN || 'lua5.3', process.env.LUA_BIN),
  };
}

function runCommand(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || ENGINES_DIR,
      env: { ...process.env, ...(opts.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, opts.timeout || ENGINE_TIMEOUT_MS);
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: err.code || err.message, stdout, stderr });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: timedOut ? false : code === 0,
        code,
        timedOut,
        stdout,
        stderr,
        error: timedOut ? 'timeout' : code === 0 ? null : `exit code ${code}`,
      });
    });
  });
}

function writeInput(code) {
  mkdirSync(TMP_DIR, { recursive: true });
  const id = randomUUID();
  const inputPath = join(TMP_DIR, `in_${id}.lua`);
  writeFileSync(inputPath, code, 'latin1');
  return { id, inputPath };
}

function readIfExists(file) {
  try {
    if (!existsSync(file)) return null;
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function readAllFromDir(dir, prefix) {
  try {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.startsWith(prefix))
      .map((f) => ({ file: join(dir, f), name: f }));
  } catch {
    return [];
  }
}

function buildResult({ detection, code, deobfuscatedCode, httpLogs, constants, notes, engine }) {
  const executionTimeMs = Date.now();
  const originalLines = code.split(/\r?\n/).length;
  const dumpedLines = deobfuscatedCode.split(/\r?\n/).length;
  return {
    success: true,
    deobfuscatedCode,
    engineUsed: engine || engineToDisplayName(detection.engine),
    obfuscatorDetected: `${detection.obfuscator} ${detection.version || ''}`.trim(),
    executionTimeMs: 0,
    httpLogs,
    constants,
    notes,
    summary: {
      totalLinesOriginal: originalLines,
      totalLinesDumped: dumpedLines,
      constantsExtracted: constants.length,
      httpCallsIntercepted: httpLogs.length,
      payloadsExtracted: deobfuscatedCode.length > 0 ? 1 : 0,
    },
  };
}

async function runMoonveil(inputPath, outPath) {
  const bins = availableBinaries();
  if (!bins.python3) return { ok: false, reason: 'python3 tidak tersedia di server' };
  const outDir = join(TMP_DIR, 'moonveil_out');
  mkdirSync(outDir, { recursive: true });
  const args = [join(ENGINES_DIR, 'moonveil', 'moonveil_decompile.py'), inputPath, outPath];
  const env = { MOONVEIL_OUT_DIR: outDir };
  if (bins.luau) env.LUAU_BIN = bins.luau;

  const res = await runCommand(bins.python3, args, { env, timeout: 120_000 });
  const out = readIfExists(outPath);
  if (out) return { ok: true, output: out, log: res.stdout + res.stderr };

  // fallback: static string recovery via moonveil_auto.py
  const auto = await runCommand(
    bins.python3,
    [join(ENGINES_DIR, 'moonveil', 'moonveil_auto.py'), inputPath],
    { env, timeout: 90_000 }
  );
  const stringsPath = inputPath.replace(/\.lua$/, '_strings.txt');
  const strings = readIfExists(stringsPath);
  if (strings) {
    return {
      ok: true,
      output: `-- [Hasil string recovery moonveil_auto.py]\n\n${strings}`,
      log: auto.stdout + auto.stderr,
    };
  }
  return { ok: false, reason: 'Moonveil devirtualisasi gagal: ' + (res.stderr || auto.stderr || 'no output'), log: res.stdout + auto.stdout };
}

async function runLarry(inputPath, outPath) {
  const bins = availableBinaries();
  if (!bins.lune) return { ok: false, reason: 'lune tidak tersedia di server' };
  const res = await runCommand(bins.lune, ['run', join(ENGINES_DIR, 'larry', 'dumper.luau'), inputPath, outPath]);
  const out = readIfExists(outPath);
  if (out) return { ok: true, output: out, log: res.stdout + res.stderr };
  return { ok: false, reason: 'Larry dumper tidak menghasilkan output: ' + (res.stderr || res.stdout || 'no output') };
}

export async function runDump({ code, engine }) {
  const src = String(code || '').trim();
  if (!src) {
    return { success: false, error: 'Kode input tidak boleh kosong' };
  }
  if (Buffer.byteLength(src, 'latin1') > MAX_INPUT_BYTES) {
    return { success: false, error: `Script terlalu besar (maks ${MAX_INPUT_BYTES / 1024 / 1024}MB)` };
  }

  const start = Date.now();
  const detection = detectObfuscator(src);
  const bins = availableBinaries();
  const requested = engine && engine !== 'auto' ? engine : detection.engine;

  const { id, inputPath } = writeInput(src);
  const outPath = join(TMP_DIR, `out_${id}.lua`);

  try {
    let result = null;
    let notes = [];

    if (requested === 'moonveil-devirt') {
      const r = await runMoonveil(inputPath, outPath);
      if (r.ok) {
        result = { deobfuscatedCode: r.output, engine: 'Moonveil Devirtualizer', httpLogs: [], constants: [] };
      } else {
        notes.push(r.reason);
      }
    } else if (['luraph-v14', 'luraph-25ms', 'prometheus-ast', 'ironbrew-deobf', 'mimic-sandbox'].includes(requested)) {
      const r = await runLarry(inputPath, outPath);
      if (r.ok) {
        result = { deobfuscatedCode: r.output, engine: 'Larry dumper.luau', httpLogs: [], constants: [] };
      } else {
        notes.push(r.reason);
      }
    }

    // Static analysis is always run in parallel with engine output
    const staticRes = staticAnalyze(src);

    if (result) {
      result.httpLogs = staticRes.httpLogs;
      result.constants = staticRes.constants;
      const combined =
        `-- [Hasil dari engine proven: ${result.engine}]\n\n` +
        result.deobfuscatedCode +
        (staticRes.payloadExtracted
          ? `\n\n-- [Lampiran analisis statis]\n\n${staticRes.deobfuscatedCode}`
          : '');
      const built = buildResult({
        detection,
        code: src,
        deobfuscatedCode: combined,
        httpLogs: staticRes.httpLogs,
        constants: staticRes.constants,
        notes,
        engine: result.engine,
      });
      built.executionTimeMs = Date.now() - start;
      return built;
    }

    // Fallback: pure static analysis (honest)
    const built = buildResult({
      detection,
      code: src,
      deobfuscatedCode: staticRes.deobfuscatedCode,
      httpLogs: staticRes.httpLogs,
      constants: staticRes.constants,
      notes: [
        ...notes,
        bins.lune ? '' : 'Dumper Larry tidak tersedia (lune belum terpasang) — memakai analisis statis.',
        bins.python3 ? '' : 'Moonveil tidak tersedia (python3 belum terpasang).',
        bins.luau ? '' : 'luau CLI belum terpasang — Moonveil hanya bisa analisis statis.',
      ].filter(Boolean),
      engine: `${engineToDisplayName(detection.engine)} (Statis)`,
    });
    built.executionTimeMs = Date.now() - start;
    return built;
  } finally {
    try {
      rmSync(inputPath, { force: true });
      rmSync(outPath, { force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}