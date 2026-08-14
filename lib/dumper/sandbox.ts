import { detectObfuscator } from './detector';
import { runStaticAnalysis } from './engine/static';
import { DumpExecutionResult, DumperEngine } from './types';

// This is the CLIENT-SIDE fallback. The full dump (running the proven engines)
// happens on the backend (Railway). Here we only do honest static decoding —
// never pretend to run a VM.
export function runDumperSandbox(sourceCode: string, _engineChoice: DumperEngine = 'auto'): DumpExecutionResult {
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

  const detection = detectObfuscator(rawSource);

  const { deobfuscatedCode, httpLogs, constants, payloadExtracted } = runStaticAnalysis(
    rawSource,
    detection.engineName
  );

  const executionTimeMs = Date.now() - startTime;
  const originalLines = rawSource.split(/\r?\n/).length;
  const dumpedLines = deobfuscatedCode.split(/\r?\n/).length;

  return {
    success: true,
    deobfuscatedCode,
    engineUsed: `${detection.engineName} (Analisis Statis Browser)`,
    obfuscatorDetected: `${detection.obfuscator} ${detection.version || ''}`.trim(),
    executionTimeMs,
    httpLogs,
    constants,
    summary: {
      totalLinesOriginal: originalLines,
      totalLinesDumped: dumpedLines,
      constantsExtracted: constants.length,
      httpCallsIntercepted: httpLogs.length,
      payloadsExtracted: payloadExtracted ? 1 : 0,
    },
  };
}