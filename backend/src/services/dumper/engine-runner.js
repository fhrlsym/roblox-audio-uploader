// Orchestrates the PROVEN dump engines by spawning them as subprocesses
// (they run on the Railway container, which has python3 / luau / lune / lua5.1 / node).
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
const TOOLS_DIR = join(BACKEND_ROOT, 'tools');
const MAX_INPUT_BYTES = 2 * 1024 * 1024; // 2MB
const ENGINE_TIMEOUT_MS = 90_000;

function resolveLocalTool(name) {
  for (const sub of ['', 'lua51']) {
    for (const exe of [name, `${name}.exe`, `${name}.cmd`, `${name}.bat`]) {
      const p = join(TOOLS_DIR, sub, exe);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

function resolveBinary(name, envVar) {
  if (envVar && existsSync(envVar)) return envVar;
  const local = resolveLocalTool(name);
  if (local) return local;
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
    lua51: resolveBinary(process.env.LUA51_BIN || 'lua5.1', process.env.LUA51_BIN),
    node: resolveBinary('node', process.env.NODE_BIN),
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

// Heuristic: is this script already human-readable Lua (not a minified blob
// with giant hex/base64 constants)? Used to decide output ordering — for
// readable scripts the original source is more useful than a compressed trace.
function isLikelyReadableLua(src) {
  const lines = src.split(/\r?\n/);
  if (lines.length < 4) return false;
  const longest = Math.max(...lines.map((l) => l.length));
  if (longest > 4000) return false; // minified mega-line -> obfuscated
  if (/["'][A-Za-z0-9+/]{300,}={0,2}["']/.test(src)) return false; // base64 blob
  if (/["'][0-9a-fA-F]{300,}["']/.test(src)) return false; // hex blob
  const keywordLines = lines.filter((l) =>
    /\b(local|function|end|return|if|then|for|while|elseif)\b/.test(l)
  ).length;
  return keywordLines / lines.length >= 0.35;
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

async function runMoonveil(inputPath, outPath, timeout) {
  const bins = availableBinaries();
  if (!bins.python3) return { ok: false, reason: 'python3 tidak tersedia di server' };
  const outDir = join(TMP_DIR, 'moonveil_out');
  mkdirSync(outDir, { recursive: true });
  const args = [join(ENGINES_DIR, 'moonveil', 'moonveil_decompile.py'), inputPath, outPath];
  const env = { MOONVEIL_OUT_DIR: outDir };
  if (bins.luau) env.LUAU_BIN = bins.luau;

  const res = await runCommand(bins.python3, args, { env, timeout: timeout || 120_000 });
  const out = readIfExists(outPath);
  if (out) return { ok: true, output: out, log: res.stdout + res.stderr };

  // fallback: static string recovery via moonveil_auto.py
  const auto = await runCommand(
    bins.python3,
    [join(ENGINES_DIR, 'moonveil', 'moonveil_auto.py'), inputPath],
    { env, timeout: timeout || 90_000 }
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

async function runLarry(inputPath, outPath, timeout) {
  const bins = availableBinaries();
  if (!bins.lune) return { ok: false, reason: 'lune tidak tersedia di server' };
  const res = await runCommand(bins.lune, ['run', join(ENGINES_DIR, 'larry', 'dumper.luau'), inputPath, outPath], { timeout: timeout || ENGINE_TIMEOUT_MS });
  const out = readIfExists(outPath);
  if (out) return { ok: true, output: out, log: res.stdout + res.stderr };
  return { ok: false, reason: 'Larry dumper tidak menghasilkan output: ' + (res.stderr || res.stdout || 'no output') };
}

async function run45ms(inputPath, outPath, timeout) {
  const bins = availableBinaries();
  if (!bins.lune) return { ok: false, reason: 'lune tidak tersedia di server' };
  const res = await runCommand(bins.lune, ['run', join(ENGINES_DIR, '45ms', '45ms.luau'), inputPath, outPath], { timeout: timeout || ENGINE_TIMEOUT_MS });
  const out = readIfExists(outPath);
  if (out && out.length > 40) return { ok: true, output: out, log: res.stdout + res.stderr };
  return { ok: false, reason: '45ms tidak menghasilkan output: ' + (res.stderr || res.stdout || 'no output') };
}

async function runUnveilr(inputPath, outPath, timeout) {
  const bins = availableBinaries();
  if (!bins.lune) return { ok: false, reason: 'lune tidak tersedia di server' };
  const res = await runCommand(
    bins.lune,
    ['run', join(ENGINES_DIR, 'unveilr', 'hi.luau'), `--file=${inputPath}`, '--raw', `--outfile=${outPath}`],
    { timeout: timeout || 60_000 }
  );
  const out = readIfExists(outPath);
  const successMarker = /\bprocess\.\s*(true|false)/.test(res.stdout) ? res.stdout.includes(', true') || res.stdout.includes(' true') : true;
  if (out && out.length > 60 && successMarker) return { ok: true, output: out, log: res.stdout + res.stderr };
  return { ok: false, reason: 'Unveilr tidak menghasilkan output: ' + (res.stderr || res.stdout || 'no output') };
}

async function runIronVeil(inputPath, outPath, timeout) {
  const bins = availableBinaries();
  if (!bins.node) return { ok: false, reason: 'node tidak tersedia di server' };
  const res = await runCommand(bins.node, [join(ENGINES_DIR, 'ironveil', 'index.js'), inputPath, outPath], { timeout: timeout || 60_000 });
  const out = readIfExists(outPath);
  if (out) return { ok: true, output: out, log: res.stdout + res.stderr };
  return { ok: false, reason: 'IronVeil-deobf gagal: ' + (res.stderr || res.stdout || 'no output') };
}

async function runPrometheusDeobf(inputPath, outPath, timeout) {
  const bins = availableBinaries();
  if (!bins.lua51) return { ok: false, reason: 'lua5.1 tidak tersedia di server' };
  const res = await runCommand(
    bins.lua51,
    [join(ENGINES_DIR, 'prometheus-deobf', 'src', 'deob', 'cli.lua'), inputPath, '--static-only', '--out', outPath],
    { timeout: timeout || 60_000 }
  );
  const out = readIfExists(outPath);
  if (out && out.length > 20) return { ok: true, output: out, log: res.stdout + res.stderr };
  return { ok: false, reason: 'Prometheus-DeobfuscatorV2 gagal: ' + (res.stderr || res.stdout || 'no output') };
}

async function runPrometheusWad(inputPath, outPath, timeout) {
  const bins = availableBinaries();
  if (!bins.python3 || !bins.lua51) return { ok: false, reason: 'python3 + lua5.1 diperlukan di server' };
  const env = { LUA51_EXECUTABLE: bins.lua51 };
  const res = await runCommand(
    bins.python3,
    [join(ENGINES_DIR, 'prom-wad', 'deobfuscator.py'), inputPath],
    { env, cwd: join(ENGINES_DIR, 'prom-wad'), timeout: timeout || 90_000 }
  );
  const out = readIfExists(`${inputPath}.deobf.lua`);
  if (out && out.length > 20) return { ok: true, output: out, log: res.stdout + res.stderr };
  return { ok: false, reason: 'Prometheus-WAD gagal: ' + (res.stderr || res.stdout || 'no output') };
}

const ENGINE_LABELS = {
  larry: 'Larry dumper.luau',
  '45ms': '45ms dumper',
  unveilr: 'UnveilR v1.0.6',
  ironveil: 'IronVeil-deobf',
  moonveil: 'Moonveil Devirtualizer',
  'prometheus-deobf': 'Prometheus-DeobfuscatorV2',
  'prometheus-wad': 'Prometheus-WAD (trace reconstruction)',
};

const ENGINE_CASCADE = {
  'luraph-v14': ['larry', '45ms', 'unveilr'],
  'luraph-25ms': ['larry', '45ms', 'unveilr'],
  'prometheus-ast': ['prometheus-deobf', 'prometheus-wad', 'larry', '45ms'],
  'ironbrew-deobf': ['larry', '45ms', 'unveilr'],
  'mimic-sandbox': ['larry', '45ms', 'unveilr'],
  'ironveil-deobf': ['ironveil', 'larry', '45ms'],
  'moonveil-devirt': ['moonveil', 'larry'],
};

const ENGINE_RUNNERS = {
  larry: runLarry,
  '45ms': run45ms,
  unveilr: runUnveilr,
  ironveil: runIronVeil,
  moonveil: runMoonveil,
  'prometheus-deobf': runPrometheusDeobf,
  'prometheus-wad': runPrometheusWad,
};

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
    // Static analysis is always available; proven engines run as a cascade.
    const staticRes = staticAnalyze(src);
    const cascade =
      ENGINE_CASCADE[requested] ||
      (requested === 'bytearray-unpacker' || requested === 'httplog-interceptor' ? [] : ['larry', '45ms', 'unveilr']);
    const engineOuts = []; // { name, output }
    const engineNotes = [];
    let primaryDone = false;
    for (const name of cascade) {
      const runner = ENGINE_RUNNERS[name];
      if (!runner) continue;
      const isPrimary = !primaryDone;
      const budget = isPrimary ? ENGINE_TIMEOUT_MS : 30_000;
      const outPathN = join(TMP_DIR, `out_${id}_${name}.lua`);
      try {
        const r = await runner(inputPath, outPathN, budget);
        if (r.ok && r.output) {
          engineOuts.push({ name, output: r.output });
          primaryDone = true;
        } else {
          engineNotes.push(r.reason);
        }
      } catch (err) {
        engineNotes.push(`${name}: ${err.message}`);
      }
      if (primaryDone && engineOuts.length > 1) break; // primary + 1 extra cukup
    }

    const readable = isLikelyReadableLua(src);
    const primary = engineOuts[0];
    const combined = (() => {
      if (readable && !staticRes.payloadExtracted) {
        const appendixes = engineOuts
          .map((e) => `-- [Lampiran: ${ENGINE_LABELS[e.name] || e.name}]\n\n${e.output}`)
          .join('\n\n');
        return (
          `-- [Script ini sudah terbaca — bukan ter-obfuscate berat.]\n` +
          `-- Di bawah = source asli (utuh). Trace engine proven ada di lampiran.\n\n${src}` +
          (appendixes ? `\n\n${appendixes}` : '')
        );
      }
      const parts = [];
      if (primary) parts.push(`-- [Hasil dari engine proven: ${ENGINE_LABELS[primary.name] || primary.name}]\n\n${primary.output}`);
      for (const e of engineOuts.slice(1)) parts.push(`-- [Hasil tambahan: ${ENGINE_LABELS[e.name] || e.name}]\n\n${e.output}`);
      if (staticRes.payloadExtracted) parts.push(`-- [Lampiran analisis statis]\n\n${staticRes.deobfuscatedCode}`);
      return parts.join('\n\n') || staticRes.deobfuscatedCode;
    })();

    const engineName = primary ? ENGINE_LABELS[primary.name] || primary.name : `${engineToDisplayName(detection.engine)} (Statis)`;
    const built = buildResult({
      detection,
      code: src,
      deobfuscatedCode: combined,
      httpLogs: staticRes.httpLogs,
      constants: staticRes.constants,
      notes: [
        ...engineNotes,
        ...(engineOuts.length === 0
          ? [
              bins.lune ? '' : 'Engine lune tidak tersedia — memakai analisis statis.',
              bins.python3 ? '' : 'Moonveil / Prometheus-WAD tidak tersedia (python3 belum terpasang).',
              bins.lua51 ? '' : 'Engine Prometheus (lua5.1) tidak tersedia.',
              bins.node ? '' : 'IronVeil tidak tersedia (node belum terpasang).',
            ]
          : []),
      ].filter(Boolean),
      engine: engineName,
    });
    built.executionTimeMs = Date.now() - start;
    return built;
  } finally {
    try {
      rmSync(inputPath, { force: true });
      rmSync(outPath, { force: true });
      for (const f of readAllFromDir(TMP_DIR, `out_${id}_`)) rmSync(f.file, { force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}