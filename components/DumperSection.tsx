'use client';

import { useState, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Code,
  Copy,
  Cpu,
  Download,
  FileCode,
  Globe,
  History as HistoryIcon,
  Key,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Shield,
  Sliders,
  Terminal,
  Trash2,
  Upload,
  Zap,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { CARD, INPUT, LABEL, BTN_PRIMARY, BTN_GHOST } from '../lib/ui';
import { useToast } from './Toast';
import { detectObfuscator } from '../lib/dumper/detector';
import { runDumperSandbox } from '../lib/dumper/sandbox';
import { DetectionResult, DumperEngine, DumpExecutionResult } from '../lib/dumper/types';
import { useDumperHistory, DumperRecord } from '../hooks/useDumperHistory';

interface DumperSectionProps {
  backendUrl?: string;
}

const SAMPLE_SCRIPTS: { label: string; engine: DumperEngine; code: string }[] = [
  {
    label: 'Luraph v14 Sample',
    engine: 'luraph-v14',
    code: `-- Protected using Luraph Obfuscator v14.7.2
local _LPH_SRC = "2d2d204c75726170682053616d706c65205363726970740d0a7072696e74282248656c6c6f2066726f6d204c757261706820564d2122290d0a67616d653a476574536572766963652822506c617965727322292e4c6f63616c506c617965722e4368617261637465722e48756d616e6f69642e57616c6b5370656564203d203530"
getgenv().SCRIPT_KEY="KEYLESS"
return(function() local N,H,g,B=string.byte,5,string.sub,{} end)()`,
  },
  {
    label: 'Moonveil Sample',
    engine: 'moonveil-devirt',
    code: `-- Moonveil Obfuscator v2
local _MOONVEIL = true
local R0 = "rbxassetid://94215284059157"
local R1 = "https://discord.com/api/webhooks/123456789/token_sample"
local R2 = function() print("Moonveil Protected Core Module Loaded") end
R2()`,
  },
  {
    label: 'Prometheus Sample',
    engine: 'prometheus-ast',
    code: `-- Prometheus Obfuscated Script
local IllIIllI = { "https://raw.githubusercontent.com/fhrlsym/sample/main/script.lua", "Players", "LocalPlayer" }
local lIIlIl = game:GetService(IllIIllI[2])
local IIlllI = lIIlIl[IllIIllI[3]]
print("Target Player:", IIlllI.Name)`,
  },
  {
    label: 'HTTP Loader Sample',
    engine: 'httplog-interceptor',
    code: `-- External Hub Loader
local sourceUrl = "https://raw.githubusercontent.com/fhrlsym/minang-music/main/musicsbjoi.json"
local webhookUrl = "https://discord.com/api/webhooks/1234567890/xyz_logger"
local payload = game:HttpGet(sourceUrl)
loadstring(payload)()`,
  },
];

export default function DumperSection({ backendUrl = '' }: DumperSectionProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { records, addRecord, deleteRecord, clearHistory } = useDumperHistory();

  // Editor Input State
  const [inputCode, setInputCode] = useState('');
  const [selectedEngine, setSelectedEngine] = useState<DumperEngine>('auto');
  const [autoBeautify, setAutoBeautify] = useState(true);

  // Execution State
  const [isProcessing, setIsProcessing] = useState(false);
  const [dumpResult, setDumpResult] = useState<DumpExecutionResult | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<'code' | 'http' | 'constants' | 'trace'>('code');
  const [constantSearchQuery, setConstantSearchQuery] = useState('');

  // History Drawer State
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Real-time Signature Auto-Detection
  const detection: DetectionResult = useMemo(() => {
    return detectObfuscator(inputCode);
  }, [inputCode]);

  // Quick Action: Paste from Clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputCode(text);
        toast('Script berhasil ditempel dari clipboard', 'success');
      } else {
        toast('Clipboard kosong', 'error');
      }
    } catch {
      toast('Gagal membaca clipboard browser', 'error');
    }
  };

  // Quick Action: File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      setInputCode(content);
      toast(`File "${file.name}" berhasil dimuat`, 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Quick Action: Load Sample
  const handleLoadSample = (sample: (typeof SAMPLE_SCRIPTS)[0]) => {
    setInputCode(sample.code);
    setSelectedEngine(sample.engine);
    toast(`Sample "${sample.label}" dimuat`, 'info');
  };

  // Helper to extract clean title snippet from script
  const getScriptSnippet = (code: string): string => {
    const firstLine = code.split(/\r?\n/).find((l) => l.trim().length > 0) || 'Luau Script';
    return firstLine.slice(0, 50).trim();
  };

  // Execute Dumper Engine (100% on Web / Server Sandbox)
  const handleRunDumper = async () => {
    if (!inputCode.trim()) {
      toast('Tempelkan script Luau/Lua terlebih dahulu', 'error');
      return;
    }

    setIsProcessing(true);
    toast('Menjalankan sandbox deobfuscator...', 'info');

    try {
      let finalResult: DumpExecutionResult | null = null;

      // 1. Try local server route /api/dumper/run
      let res: Response | null = null;
      try {
        res = await fetch('/api/dumper/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: inputCode,
            engine: selectedEngine,
            autoBeautify,
          }),
        });
      } catch {
        // fallback
      }

      // 2. If Next.js route fails, try backendUrl
      if ((!res || !res.ok) && backendUrl) {
        try {
          res = await fetch(`${backendUrl}/api/dumper/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: inputCode,
              engine: selectedEngine,
              autoBeautify,
            }),
          });
        } catch {
          // fallback
        }
      }

      if (res && res.ok) {
        finalResult = (await res.json()) as DumpExecutionResult;
      } else {
        // 3. Fallback to client-side sandbox execution
        finalResult = runDumperSandbox(inputCode, selectedEngine);
      }

      if (finalResult && finalResult.success) {
        setDumpResult(finalResult);
        setActiveOutputTab('code');

        // Automatically record into Dumper History
        const newRecord: DumperRecord = {
          id: `dump_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: getScriptSnippet(inputCode),
          obfuscator: finalResult.obfuscatorDetected || detection.obfuscator,
          engine: finalResult.engineUsed || detection.engineName,
          originalLines: finalResult.summary.totalLinesOriginal,
          dumpedLines: finalResult.summary.totalLinesDumped,
          constantsCount: finalResult.summary.constantsExtracted,
          httpLogsCount: finalResult.summary.httpCallsIntercepted,
          executionTimeMs: finalResult.executionTimeMs,
          inputSnippet: getScriptSnippet(inputCode),
          inputCode,
          dumpedCode: finalResult.deobfuscatedCode,
          httpLogs: finalResult.httpLogs,
          constants: finalResult.constants,
          createdAt: Date.now(),
        };

        addRecord(newRecord);
        toast(`Berhasil membongkar script (${finalResult.executionTimeMs}ms) & disimpan ke riwayat!`, 'success');
      } else {
        toast(finalResult?.error || 'Gagal mengeksekusi dumper', 'error');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal mengeksekusi dumper';
      toast(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Restore record from history
  const handleLoadFromHistory = (rec: DumperRecord) => {
    setInputCode(rec.inputCode);
    setDumpResult({
      success: true,
      deobfuscatedCode: rec.dumpedCode,
      engineUsed: rec.engine,
      obfuscatorDetected: rec.obfuscator,
      executionTimeMs: rec.executionTimeMs,
      httpLogs: rec.httpLogs || [],
      constants: rec.constants || [],
      summary: {
        totalLinesOriginal: rec.originalLines,
        totalLinesDumped: rec.dumpedLines,
        constantsExtracted: rec.constantsCount,
        httpCallsIntercepted: rec.httpLogsCount,
        payloadsExtracted: rec.httpLogsCount + 1,
      },
    });
    setActiveOutputTab('code');
    toast(`Riwayat "${rec.title}" dimuat ke workspace`, 'info');
  };

  // Output Actions: Copy & Download
  const handleCopyCode = (codeToCopy?: string) => {
    const target = codeToCopy || dumpResult?.deobfuscatedCode;
    if (!target) return;
    navigator.clipboard.writeText(target);
    toast('Source code berhasil disalin ke clipboard', 'success');
  };

  const handleDownloadCode = (codeToDownload?: string, prefix = 'dumped') => {
    const target = codeToDownload || dumpResult?.deobfuscatedCode;
    if (!target) return;
    const blob = new Blob([target], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}_${Date.now()}.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('File .lua berhasil diunduh', 'success');
  };

  // Filtered Constants
  const filteredConstants = useMemo(() => {
    if (!dumpResult?.constants) return [];
    if (!constantSearchQuery.trim()) return dumpResult.constants;
    const q = constantSearchQuery.toLowerCase().trim();
    return dumpResult.constants.filter(
      (c) => c.value.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)
    );
  }, [dumpResult?.constants, constantSearchQuery]);

  // Filtered History Records
  const filteredHistory = useMemo(() => {
    if (!historySearchQuery.trim()) return records;
    const q = historySearchQuery.toLowerCase().trim();
    return records.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.obfuscator.toLowerCase().includes(q) ||
        r.engine.toLowerCase().includes(q)
    );
  }, [records, historySearchQuery]);

  const lineCount = inputCode ? inputCode.split(/\r?\n/).length : 0;
  const charCount = inputCode.length;

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".lua,.luau,.txt"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Banner & Overview */}
      <div className={`${CARD} p-4 sm:p-5 relative overflow-hidden`}>
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--accent-40)] via-[var(--accent)] to-[var(--accent-strong)]" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-15)] flex items-center justify-center text-[var(--accent)] shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
                Luau Script Dumper &amp; Deobfuscator
              </h2>
              <p className="text-xs text-[var(--text-45)]">
                Multi-Engine Luau Virtual Sandbox (Luraph v11–v14+, Moonveil, Prometheus AST, Mimic V3, 25ms HttpLog)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-[var(--text-40)]">Sample:</span>
            {SAMPLE_SCRIPTS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => handleLoadSample(s)}
                className="px-2.5 py-1 rounded-lg border border-[var(--line)] bg-[var(--surface-50)] text-[11px] font-medium text-[var(--text-70)] hover:text-[var(--text)] hover:border-[var(--accent-30)] hover:bg-[var(--surface)] transition"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main 2-Column Split Workstation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Input Editor & Signature Detection (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          <div className={`${CARD} p-4 space-y-3`}>
            <div className="flex items-center justify-between">
              <label className={LABEL}>Script Target (Obfuscated Luau / Lua)</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--line)] text-[11px] font-medium text-[var(--accent-soft)] hover:bg-[var(--accent-10)] transition"
                  title="Paste dari Clipboard"
                >
                  <Copy className="w-3 h-3" />
                  Paste
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--line)] text-[11px] font-medium text-[var(--text-60)] hover:text-[var(--text)] hover:bg-[var(--surface-50)] transition"
                  title="Upload File .lua / .txt"
                >
                  <Upload className="w-3 h-3" />
                  Upload
                </button>
                {inputCode && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputCode('');
                      setDumpResult(null);
                    }}
                    className="p-1 rounded-lg text-[var(--text-35)] hover:text-[var(--danger)] transition"
                    title="Hapus Input"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Tempelkan script Luau/Lua yang ter-obfuscate di sini..."
              className={`${INPUT} font-mono text-xs h-80 resize-y leading-relaxed p-3.5`}
              spellCheck={false}
            />

            <div className="flex items-center justify-between text-[11px] text-[var(--text-40)] font-mono pt-1">
              <span>Baris: {lineCount}</span>
              <span>Karakter: {charCount.toLocaleString()}</span>
            </div>
          </div>

          {/* Auto-Detection Card */}
          <div className={`${CARD} p-4 space-y-2.5 border-[var(--accent-25)] bg-[var(--accent-06)]`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--accent-soft)]" />
                <span className="text-xs font-bold text-[var(--text)]">Auto-Detection Signature</span>
              </div>
              <span className="rounded-full bg-[var(--accent-15)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--accent-strong)]">
                Akurasi {detection.confidence}%
              </span>
            </div>

            <div className="p-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--accent-strong)]">{detection.obfuscator}</span>
                {detection.version && (
                  <span className="font-mono text-[10px] text-[var(--text-50)]">{detection.version}</span>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-60)] leading-relaxed">
                {detection.description}
              </p>
              {detection.features.length > 0 && (
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {detection.features.map((f) => (
                    <span key={f} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-strong)] text-[var(--text-60)]">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Engine Selector Dropdown */}
            <div className="pt-2 border-t border-[var(--line)] space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-45)] flex items-center gap-1">
                <Sliders className="w-3 h-3 text-[var(--accent-soft)]" />
                Pilih Engine Dumper
              </label>
              <select
                value={selectedEngine}
                onChange={(e) => setSelectedEngine(e.target.value as DumperEngine)}
                className={`${INPUT} text-xs py-2 bg-[var(--surface-focus)] font-medium`}
              >
                <option value="auto">Auto-Detect (Rekomendasi: {detection.engineName})</option>
                <option value="moonveil-devirt">Moonveil VM Devirtualizer (2zvh/moonveilvro)</option>
                <option value="luraph-v14">Luraph v14.x Proto Dumper (2zvh/-)</option>
                <option value="luraph-25ms">25ms Luraph Dumper Engine</option>
                <option value="prometheus-ast">Prometheus AST Unparser (Larry Engine)</option>
                <option value="ironbrew-deobf">IronBrew 1 &amp; 2 Deserializer</option>
                <option value="bytearray-unpacker">Byte Array &amp; Char Unpacker</option>
                <option value="httplog-interceptor">25ms HTTP &amp; Webhook Interceptor</option>
                <option value="revea-env">Revea.lol &amp; Kolenv Memory Dumper</option>
                <option value="mimic-sandbox">Mimic V3 Universal Sandbox</option>
              </select>
            </div>

            {/* Execution Options */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-[11px] text-[var(--text-70)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoBeautify}
                  onChange={(e) => setAutoBeautify(e.target.checked)}
                  className="rounded border-[var(--line)] accent-[var(--accent)] w-3.5 h-3.5"
                />
                <span>Auto Format &amp; Indentasi Kode</span>
              </label>
            </div>

            {/* Big Run Button */}
            <button
              type="button"
              onClick={handleRunDumper}
              disabled={isProcessing || !inputCode.trim()}
              className={`${BTN_PRIMARY} w-full py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Mengeksekusi Virtual Sandbox...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Run Dumper ({selectedEngine === 'auto' ? detection.engineName : selectedEngine})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Output Inspector & Results (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-4">
          <div className={`${CARD} p-4 space-y-4 min-h-[500px] flex flex-col`}>
            {/* Output Tabs Header */}
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-1 p-1 bg-[var(--surface-50)] rounded-xl border border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setActiveOutputTab('code')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeOutputTab === 'code'
                      ? 'bg-[var(--accent)] text-[#000000] shadow-sm'
                      : 'text-[var(--text-60)] hover:text-[var(--text)]'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Source Code</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveOutputTab('http')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeOutputTab === 'http'
                      ? 'bg-[var(--accent)] text-[#000000] shadow-sm'
                      : 'text-[var(--text-60)] hover:text-[var(--text)]'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>HTTP Logs</span>
                  {dumpResult && dumpResult.httpLogs.length > 0 && (
                    <span className="rounded-full bg-black/20 px-1.5 py-0.2 text-[9px] font-bold">
                      {dumpResult.httpLogs.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveOutputTab('constants')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeOutputTab === 'constants'
                      ? 'bg-[var(--accent)] text-[#000000] shadow-sm'
                      : 'text-[var(--text-60)] hover:text-[var(--text)]'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Constant Pool</span>
                  {dumpResult && dumpResult.constants.length > 0 && (
                    <span className="rounded-full bg-black/20 px-1.5 py-0.2 text-[9px] font-bold">
                      {dumpResult.constants.length}
                    </span>
                  )}
                </button>

                {dumpResult?.vmTraces && dumpResult.vmTraces.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveOutputTab('trace')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      activeOutputTab === 'trace'
                        ? 'bg-[var(--accent)] text-[#000000] shadow-sm'
                        : 'text-[var(--text-60)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>VM Trace</span>
                  </button>
                )}
              </div>

              {/* Output Actions */}
              {dumpResult && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyCode()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent-15)] text-xs font-bold text-[var(--accent-strong)] hover:bg-[var(--accent-20)] transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Salin Kode
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadCode()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-50)] text-xs font-bold text-[var(--text-80)] hover:bg-[var(--surface)] transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .lua
                  </button>
                </div>
              )}
            </div>

            {/* Output Content Area */}
            {!dumpResult ? (
              <div className="flex-1 flex flex-col items-center justify-center py-24 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--surface-50)] border border-[var(--line)] flex items-center justify-center text-[var(--text-35)]">
                  <FileCode className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-70)]">Belum Ada Hasil Dump</p>
                  <p className="text-xs text-[var(--text-40)] max-w-sm mt-1">
                    Tempelkan script target di sebelah kiri lalu klik &quot;Run Dumper&quot; untuk menjalankan sandbox.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col space-y-3">
                {/* Summary Info Bar */}
                <div className="flex items-center justify-between text-[11px] font-mono p-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-50)]">
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--accent-soft)] font-bold">
                      Engine: {dumpResult.engineUsed}
                    </span>
                    <span className="text-[var(--text-40)]">|</span>
                    <span className="text-[var(--text-60)]">
                      Waktu: {dumpResult.executionTimeMs}ms
                    </span>
                  </div>
                  <span className="text-[var(--emerald)] font-bold">
                    {dumpResult.summary.totalLinesDumped} Baris Kode
                  </span>
                </div>

                {/* Tab 1: Source Code Viewer */}
                {activeOutputTab === 'code' && (
                  <pre className="flex-1 p-4 rounded-xl bg-black/70 border border-[var(--line)] font-mono text-xs text-[var(--text)] overflow-auto max-h-[550px] leading-relaxed select-text">
                    {dumpResult.deobfuscatedCode}
                  </pre>
                )}

                {/* Tab 2: HTTP & Webhook Logs */}
                {activeOutputTab === 'http' && (
                  <div className="space-y-2 flex-1 overflow-auto max-h-[550px]">
                    {dumpResult.httpLogs.length === 0 ? (
                      <div className="py-12 text-center text-xs text-[var(--text-40)]">
                        Tidak ada pemanggilan HTTP / Webhook terdeteksi di script ini.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dumpResult.httpLogs.map((log) => (
                          <div
                            key={log.id}
                            className="p-3 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] flex items-start justify-between gap-3"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  log.method === 'POST' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                                }`}>
                                  {log.method}
                                </span>
                                <span className="rounded bg-[var(--surface-strong)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-50)]">
                                  {log.interceptedType}
                                </span>
                                <span className="text-[10px] text-[var(--text-40)]">{log.timestamp}</span>
                              </div>
                              <code className="text-xs font-mono text-[var(--accent-soft)] break-all block">
                                {log.url}
                              </code>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(log.url);
                                toast('URL disalin', 'success');
                              }}
                              className="p-1.5 rounded-lg border border-[var(--line)] hover:bg-[var(--surface)] text-[var(--text-50)] hover:text-[var(--text)] transition shrink-0"
                              title="Salin URL"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Constant Pool */}
                {activeOutputTab === 'constants' && (
                  <div className="space-y-3 flex-1 flex flex-col">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-40)]" />
                      <input
                        type="text"
                        value={constantSearchQuery}
                        onChange={(e) => setConstantSearchQuery(e.target.value)}
                        placeholder="Cari konstanta string..."
                        className={`${INPUT} text-xs pl-8 py-1.5`}
                      />
                    </div>

                    <div className="flex-1 overflow-auto max-h-[500px] space-y-1.5">
                      {filteredConstants.length === 0 ? (
                        <div className="py-12 text-center text-xs text-[var(--text-40)]">
                          Tidak ada konstanta yang cocok dengan pencarian.
                        </div>
                      ) : (
                        filteredConstants.map((c) => (
                          <div
                            key={c.id}
                            className="p-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="rounded bg-[var(--surface-strong)] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--text-50)] shrink-0">
                                {c.type}
                              </span>
                              <code className="text-xs font-mono text-[var(--text-80)] truncate">
                                {c.value}
                              </code>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(c.value);
                                toast('Konstanta disalin', 'success');
                              }}
                              className="p-1 text-[var(--text-40)] hover:text-[var(--accent-soft)] transition shrink-0"
                              title="Salin Konstanta"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 4: VM Trace */}
                {activeOutputTab === 'trace' && dumpResult.vmTraces && (
                  <div className="space-y-2 flex-1 overflow-auto max-h-[550px]">
                    <div className="space-y-1.5">
                      {dumpResult.vmTraces.map((t, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] text-xs font-mono flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--text-40)]">#{t.line}</span>
                            <span className="px-1.5 py-0.5 rounded bg-[var(--accent-15)] text-[var(--accent-strong)] font-bold text-[10px]">
                              {t.opcode}
                            </span>
                            <span className="text-[var(--text-70)]">
                              {JSON.stringify(t.registers)}
                            </span>
                          </div>
                          {t.description && (
                            <span className="text-[10px] text-[var(--text-40)]">{t.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline Collapsible Dumper History Drawer */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-2.5 text-xs font-semibold text-[var(--text-80)] transition hover:border-[var(--accent-30)] hover:text-[var(--accent-strong)] hover:bg-[var(--surface)]"
          >
            <HistoryIcon className="w-4 h-4 text-[var(--accent-soft)]" />
            <span>Riwayat Dump</span>
            {records.length > 0 && (
              <span className="rounded-full bg-[var(--accent-15)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-strong)]">
                {records.length}
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-[var(--text-45)] transition-transform duration-300 ${
                historyOpen ? 'rotate-180 text-[var(--accent)]' : ''
              }`}
            />
          </button>
        </div>

        <AnimatePresence>
          {historyOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className={`${CARD} p-4 space-y-3`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
                  <div className="flex items-center gap-2">
                    <HistoryIcon className="w-4 h-4 text-[var(--accent)]" />
                    <h3 className="text-sm font-bold text-[var(--text)]">Daftar Riwayat Dump Script</h3>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {records.length > 3 && (
                      <div className="relative flex-1 sm:w-48">
                        <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-40)]" />
                        <input
                          type="text"
                          value={historySearchQuery}
                          onChange={(e) => setHistorySearchQuery(e.target.value)}
                          placeholder="Cari riwayat..."
                          className={`${INPUT} text-[11px] pl-7 py-1`}
                        />
                      </div>
                    )}

                    {records.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Hapus seluruh riwayat dump?')) {
                            clearHistory();
                            toast('Riwayat dump berhasil dibersihkan', 'info');
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--line)] text-[11px] font-medium text-[var(--text-50)] hover:text-[var(--danger)] hover:border-red-500/30 transition shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                        Hapus Semua
                      </button>
                    )}
                  </div>
                </div>

                {records.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-40)]">
                    Belum ada riwayat dump script. Script yang Anda dump akan otomatis tersimpan di sini.
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[var(--text-40)]">
                    Tidak ada riwayat yang cocok dengan pencarian &quot;{historySearchQuery}&quot;.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {filteredHistory.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-3 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] hover:bg-[var(--surface)] transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-[var(--text-90)] truncate max-w-xs">
                              {rec.title}
                            </span>
                            <span className="rounded bg-[var(--accent-15)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-strong)]">
                              {rec.obfuscator}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--text-40)]">
                              {new Date(rec.createdAt).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--text-50)] flex-wrap">
                            <span>Engine: {rec.engine}</span>
                            <span>•</span>
                            <span>{rec.dumpedLines} Baris</span>
                            <span>•</span>
                            <span>{rec.constantsCount} Konstanta</span>
                            {rec.httpLogsCount > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-[var(--accent-soft)]">
                                  {rec.httpLogsCount} HTTP Intercepted
                                </span>
                              </>
                            )}
                            <span>•</span>
                            <span>{rec.executionTimeMs}ms</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLoadFromHistory(rec)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-15)] text-[11px] font-bold text-[var(--accent-strong)] hover:bg-[var(--accent-20)] transition"
                            title="Buka kembali di editor"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Buka
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(rec.dumpedCode)}
                            className="p-1.5 rounded-lg border border-[var(--line)] text-[var(--text-60)] hover:text-[var(--text)] transition"
                            title="Salin Source Code"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadCode(rec.dumpedCode, `dumped_${rec.obfuscator}`)}
                            className="p-1.5 rounded-lg border border-[var(--line)] text-[var(--text-60)] hover:text-[var(--text)] transition"
                            title="Download .lua"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRecord(rec.id)}
                            className="p-1.5 rounded-lg text-[var(--text-35)] hover:text-[var(--danger)] transition"
                            title="Hapus dari Riwayat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
