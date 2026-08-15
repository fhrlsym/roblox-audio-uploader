'use client';

import { useState, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Code,
  Copy,
  Download,
  FileCode,
  Loader2,
  Lock,
  Shield,
  Sliders,
  Trash2,
  Upload,
  Wand2,
  Zap,
  Eye,
  Layers,
  Cpu,
  ChevronDown,
} from 'lucide-react';
import { CARD, INPUT, LABEL, BTN_PRIMARY } from '../lib/ui';
import { useToast } from './Toast';

interface ObfuscatorSettings {
  encryptStrings: boolean;
  proxifyLocals: boolean;
  proxifyFunctions: boolean;
  antiTamper: boolean;
  controlFlowFlattening: boolean;
  isLuauRuntime: boolean;
  loaderVMDepth: number;
}

const DEFAULT_SETTINGS: ObfuscatorSettings = {
  encryptStrings: true,
  proxifyLocals: true,
  proxifyFunctions: true,
  antiTamper: true,
  controlFlowFlattening: true,
  isLuauRuntime: false,
  loaderVMDepth: 3,
};

const PRESETS: {
  id: string;
  label: string;
  badge: string;
  icon: typeof Zap;
  settings: ObfuscatorSettings;
}[] = [
  {
    id: 'roblox',
    label: 'Roblox Studio',
    badge: 'Safe & Stable',
    icon: Lock,
    settings: {
      encryptStrings: true,
      proxifyLocals: true,
      proxifyFunctions: false,
      antiTamper: false,
      controlFlowFlattening: true,
      isLuauRuntime: true,
      loaderVMDepth: 2,
    },
  },
  {
    id: 'light',
    label: 'Light',
    badge: 'Strings only',
    icon: Shield,
    settings: {
      encryptStrings: true,
      proxifyLocals: false,
      proxifyFunctions: false,
      antiTamper: false,
      controlFlowFlattening: false,
      isLuauRuntime: false,
      loaderVMDepth: 1,
    },
  },
  {
    id: 'standard',
    label: 'Standard',
    badge: 'Balanced',
    icon: Zap,
    settings: {
      encryptStrings: true,
      proxifyLocals: true,
      proxifyFunctions: false,
      antiTamper: false,
      controlFlowFlattening: true,
      isLuauRuntime: false,
      loaderVMDepth: 2,
    },
  },
  {
    id: 'heavy',
    label: 'Heavy',
    badge: 'Full Protection',
    icon: Lock,
    settings: {
      encryptStrings: true,
      proxifyLocals: true,
      proxifyFunctions: true,
      antiTamper: true,
      controlFlowFlattening: true,
      isLuauRuntime: false,
      loaderVMDepth: 3,
    },
  },
  {
    id: 'maximum',
    label: 'Maximum',
    badge: 'V8 Depth 5',
    icon: Cpu,
    settings: {
      encryptStrings: true,
      proxifyLocals: true,
      proxifyFunctions: true,
      antiTamper: true,
      controlFlowFlattening: true,
      isLuauRuntime: false,
      loaderVMDepth: 5,
    },
  },
];

const SAMPLE_SCRIPTS = [
  {
    label: 'Hello World',
    code: `-- Simple Hello World Script
local Players = game:GetService("Players")
local player = Players.LocalPlayer

print("Hello from " .. player.Name)
player.Character.Humanoid.WalkSpeed = 50`,
  },
  {
    label: 'ESP Script',
    code: `-- ESP Highlight Script
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local localPlayer = Players.LocalPlayer

local function createESP(target)
    local highlight = Instance.new("Highlight")
    highlight.FillColor = Color3.fromRGB(255, 0, 0)
    highlight.OutlineColor = Color3.fromRGB(255, 255, 255)
    highlight.Parent = target.Character
end

for _, player in ipairs(Players:GetPlayers()) do
    if player ~= localPlayer and player.Character then
        createESP(player)
    end
end`,
  },
  {
    label: 'Script Hub Loader',
    code: `-- External Script Hub Loader
local HttpService = game:GetService("HttpService")
local scriptUrl = "https://raw.githubusercontent.com/example/hub/main/loader.lua"
local webhookUrl = "https://discord.com/api/webhooks/1234567890/abcdef"

local success, source = pcall(function()
    return game:HttpGet(scriptUrl)
end)

if success then
    loadstring(source)()
else
    warn("Failed to load script hub: " .. tostring(source))
end`,
  },
];

const STORAGE_KEY = 's2studio_obfuscatorHistory';

interface HistoryRecord {
  id: string;
  title: string;
  settings: ObfuscatorSettings;
  originalLines: number;
  obfuscatedLines: number;
  executionTimeMs: number;
  inputCode: string;
  outputCode: string;
  createdAt: number;
}

export default function ObfuscatorSection() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input State
  const [inputCode, setInputCode] = useState('');
  const [settings, setSettings] = useState<ObfuscatorSettings>({ ...DEFAULT_SETTINGS });
  const [settingsOpen, setSettingsOpen] = useState(true);

  // Output State
  const [outputCode, setOutputCode] = useState('');
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);

  // Processing State
  const [isProcessing, setIsProcessing] = useState(false);

  // History State
  const [history, setHistory] = useState<HistoryRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [historyOpen, setHistoryOpen] = useState(false);

  // Save history to localStorage
  const saveHistory = (records: HistoryRecord[]) => {
    setHistory(records);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 30)));
    } catch {}
  };

  // Active preset detection
  const activePreset = useMemo(() => {
    return PRESETS.find(
      (p) =>
        p.settings.encryptStrings === settings.encryptStrings &&
        p.settings.proxifyLocals === settings.proxifyLocals &&
        p.settings.proxifyFunctions === settings.proxifyFunctions &&
        p.settings.antiTamper === settings.antiTamper &&
        p.settings.controlFlowFlattening === settings.controlFlowFlattening &&
        p.settings.isLuauRuntime === settings.isLuauRuntime &&
        p.settings.loaderVMDepth === settings.loaderVMDepth
    )?.id || 'custom';
  }, [settings]);

  // Toggle a boolean setting
  const toggleSetting = (key: keyof ObfuscatorSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Apply preset
  const applyPreset = (preset: typeof PRESETS[0]) => {
    setSettings({ ...preset.settings });
    toast(`Preset "${preset.label}" diterapkan`, 'info');
  };

  // Quick Actions
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

  const handleLoadSample = (sample: typeof SAMPLE_SCRIPTS[0]) => {
    setInputCode(sample.code);
    toast(`Sample "${sample.label}" dimuat`, 'info');
  };

  // Execute Obfuscation
  const handleObfuscate = async () => {
    if (!inputCode.trim()) {
      toast('Tempelkan script Luau/Lua terlebih dahulu', 'error');
      return;
    }

    setIsProcessing(true);
    toast('Mengobfuscate script...', 'info');

    try {
      const res = await fetch('/api/obfuscator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: inputCode, settings }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Obfuscation gagal');
      }

      setOutputCode(data.result);
      setExecutionTimeMs(data.executionTimeMs);

      // Save to history
      const newRecord: HistoryRecord = {
        id: `obf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: inputCode.split(/\r?\n/).find((l) => l.trim().length > 0)?.slice(0, 50).trim() || 'Luau Script',
        settings: { ...settings },
        originalLines: inputCode.split(/\r?\n/).length,
        obfuscatedLines: data.result.split(/\r?\n/).length,
        executionTimeMs: data.executionTimeMs,
        inputCode,
        outputCode: data.result,
        createdAt: Date.now(),
      };
      saveHistory([newRecord, ...history.filter((r) => r.id !== newRecord.id)].slice(0, 30));

      toast(`Berhasil obfuscate (${data.executionTimeMs}ms)!`, 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal mengobfuscate script';
      toast(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Output Actions
  const handleCopyOutput = () => {
    if (!outputCode) return;
    navigator.clipboard.writeText(outputCode);
    toast('Obfuscated code disalin ke clipboard', 'success');
  };

  const handleDownloadOutput = () => {
    if (!outputCode) return;
    const blob = new Blob([outputCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `obfuscated_${Date.now()}.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('File .lua berhasil diunduh', 'success');
  };

  // Load from history
  const handleLoadFromHistory = (rec: HistoryRecord) => {
    setInputCode(rec.inputCode);
    setSettings(rec.settings);
    setOutputCode(rec.outputCode);
    setExecutionTimeMs(rec.executionTimeMs);
    toast(`Riwayat "${rec.title}" dimuat`, 'info');
  };

  const lineCount = inputCode ? inputCode.split(/\r?\n/).length : 0;
  const charCount = inputCode.length;
  const outputLineCount = outputCode ? outputCode.split(/\r?\n/).length : 0;

  const activeSettingsCount = [
    settings.encryptStrings,
    settings.proxifyLocals,
    settings.proxifyFunctions,
    settings.antiTamper,
    settings.controlFlowFlattening,
    settings.isLuauRuntime,
  ].filter(Boolean).length;

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

      {/* Top Banner */}
      <div className={`${CARD} p-4 sm:p-5 relative overflow-hidden`}>
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--accent-40)] via-[var(--accent)] to-[var(--accent-strong)]" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-15)] flex items-center justify-center text-[var(--accent)] shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
                Script Obfuscator
              </h2>
              <p className="text-xs text-[var(--text-45)]">
                Proteksi script Luau/Lua Anda dengan Goofyscator V8 — string encryption, control flow, anti-tamper
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
        {/* Left Column: Input Editor & Settings (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Input Editor */}
          <div className={`${CARD} p-4 space-y-3`}>
            <div className="flex items-center justify-between">
              <label className={LABEL}>Script Input (Lua / Luau)</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--line)] text-[11px] font-medium text-[var(--accent-soft)] hover:bg-[var(--accent-10)] transition"
                >
                  <Copy className="w-3 h-3" />
                  Paste
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--line)] text-[11px] font-medium text-[var(--text-60)] hover:text-[var(--text)] hover:bg-[var(--surface-50)] transition"
                >
                  <Upload className="w-3 h-3" />
                  Upload
                </button>
                {inputCode && (
                  <button
                    type="button"
                    onClick={() => { setInputCode(''); setOutputCode(''); setExecutionTimeMs(null); }}
                    className="p-1 rounded-lg text-[var(--text-35)] hover:text-[var(--danger)] transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Tempelkan script Luau/Lua yang ingin di-obfuscate di sini..."
              className={`${INPUT} font-mono text-xs h-64 resize-y leading-relaxed p-3.5`}
              spellCheck={false}
            />

            <div className="flex items-center justify-between text-[11px] text-[var(--text-40)] font-mono pt-1">
              <span>Baris: {lineCount}</span>
              <span>Karakter: {charCount.toLocaleString()}</span>
            </div>
          </div>

          {/* Settings Panel */}
          <div className={`${CARD} p-4 space-y-3`}>
            <button
              type="button"
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[var(--accent-soft)]" />
                <span className="text-xs font-bold text-[var(--text)]">Pengaturan Obfuscation</span>
                <span className="rounded-full bg-[var(--accent-15)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-strong)]">
                  {activeSettingsCount} aktif
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-[var(--text-45)] transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 overflow-hidden"
                >
                  {/* Presets */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-45)] mb-2">One-Click Presets</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PRESETS.map((preset) => {
                        const Icon = preset.icon;
                        const isActive = activePreset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyPreset(preset)}
                            className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all duration-150 ${
                              isActive
                                ? 'border-[var(--accent-40)] bg-[var(--accent-15)] shadow-sm'
                                : 'border-[var(--line)] bg-[var(--surface-50)] hover:border-[var(--accent-20)] hover:bg-[var(--surface)]'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 w-full">
                              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--accent-strong)]' : 'text-[var(--text-60)]'}`} />
                              <span className={`text-xs font-bold truncate ${isActive ? 'text-[var(--accent-strong)]' : 'text-[var(--text-90)]'}`}>
                                {preset.label}
                              </span>
                            </div>
                            <span className={`text-[10px] mt-1 font-mono ${isActive ? 'text-[var(--accent-soft)]' : 'text-[var(--text-45)]'}`}>
                              {preset.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Toggle Settings */}
                  <div className="pt-2 border-t border-[var(--line)] space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-45)] mb-1">Individual Settings</p>
                    {([
                      { key: 'encryptStrings' as const, label: 'Encrypt Strings', desc: 'Enkripsi semua string literal' },
                      { key: 'proxifyLocals' as const, label: 'Proxify Locals', desc: 'Wrap variabel lokal dengan proxy' },
                      { key: 'proxifyFunctions' as const, label: 'Proxify Functions', desc: 'Wrap semua function calls' },
                      { key: 'antiTamper' as const, label: 'Anti-Tamper', desc: 'Proteksi terhadap debugging & modifikasi' },
                      { key: 'controlFlowFlattening' as const, label: 'Control Flow', desc: 'Flatten struktur kontrol menjadi dispatch loop' },
                      { key: 'isLuauRuntime' as const, label: 'Luau Runtime', desc: 'Optimasi untuk Roblox Luau VM' },
                    ]).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => toggleSetting(item.key)}
                        className={`flex items-center justify-between w-full rounded-xl border p-2.5 transition-all ${
                          settings[item.key]
                            ? 'border-[var(--accent-30)] bg-[var(--accent-06)]'
                            : 'border-[var(--line)] bg-[var(--surface-50)] hover:border-[var(--accent-20)]'
                        }`}
                      >
                        <div className="text-left">
                          <p className={`text-xs font-semibold ${settings[item.key] ? 'text-[var(--text)]' : 'text-[var(--text-60)]'}`}>
                            {item.label}
                          </p>
                          <p className="text-[10px] text-[var(--text-40)]">{item.desc}</p>
                        </div>
                        <div className={`w-9 h-5 rounded-full transition-all shrink-0 ml-2 flex items-center ${
                          settings[item.key] ? 'bg-[var(--accent)] justify-end' : 'bg-[var(--surface-strong)] justify-start'
                        }`}>
                          <div className={`w-4 h-4 rounded-full mx-0.5 transition-all ${
                            settings[item.key] ? 'bg-white shadow-sm' : 'bg-[var(--text-30)]'
                          }`} />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* VM Depth Slider */}
                  <div className="pt-2 border-t border-[var(--line)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[var(--accent-soft)]" />
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-45)]">
                          Loader VM Depth
                        </label>
                      </div>
                      <span className="font-mono text-sm text-[var(--accent-strong)] font-bold">{settings.loaderVMDepth}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={settings.loaderVMDepth}
                      onChange={(e) => setSettings((prev) => ({ ...prev, loaderVMDepth: parseInt(e.target.value) }))}
                      className="w-full accent-[var(--accent)]"
                    />
                    <div className="flex justify-between text-[9px] text-[var(--text-35)] font-mono mt-1">
                      <span>1 (Fast)</span>
                      <span>2</span>
                      <span>3</span>
                      <span>4</span>
                      <span>5 (Deep)</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Big Run Button */}
          <button
            type="button"
            onClick={handleObfuscate}
            disabled={isProcessing || !inputCode.trim()}
            className={`${BTN_PRIMARY} w-full py-3.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mengobfuscate script...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Obfuscate Script
              </>
            )}
          </button>
        </div>

        {/* Right Column: Output Viewer (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className={`${CARD} p-4 space-y-4 min-h-[500px] flex flex-col`}>
            {/* Output Header */}
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 p-1 bg-[var(--surface-50)] rounded-xl border border-[var(--line)]">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-[#000000] shadow-sm">
                    <Code className="w-3.5 h-3.5" />
                    <span>Obfuscated Output</span>
                  </div>
                </div>
              </div>

              {outputCode && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyOutput}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent-15)] text-xs font-bold text-[var(--accent-strong)] hover:bg-[var(--accent-20)] transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Salin Kode
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadOutput}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-50)] text-xs font-bold text-[var(--text-80)] hover:bg-[var(--surface)] transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .lua
                  </button>
                </div>
              )}
            </div>

            {/* Output Content */}
            {!outputCode ? (
              <div className="flex-1 flex flex-col items-center justify-center py-24 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--surface-50)] border border-[var(--line)] flex items-center justify-center text-[var(--text-35)]">
                  <FileCode className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-70)]">Belum Ada Output</p>
                  <p className="text-xs text-[var(--text-40)] max-w-sm mt-1">
                    Tempelkan script di sebelah kiri, atur settings, lalu klik &quot;Obfuscate Script&quot; untuk memproteksi kode Anda.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col space-y-3">
                {/* Summary Info Bar */}
                <div className="flex items-center justify-between text-[11px] font-mono p-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-50)]">
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--accent-soft)] font-bold">
                      Goofyscator V8
                    </span>
                    <span className="text-[var(--text-40)]">|</span>
                    <span className="text-[var(--text-60)]">
                      {executionTimeMs != null ? `${executionTimeMs}ms` : '-'}
                    </span>
                  </div>
                  <span className="text-[var(--emerald)] font-bold">
                    {outputLineCount} Baris Output
                  </span>
                </div>

                {/* Code Viewer */}
                <pre className="flex-1 p-4 rounded-xl bg-black/70 border border-[var(--line)] font-mono text-xs text-[var(--text)] overflow-auto max-h-[550px] leading-relaxed select-text">
                  {outputCode}
                </pre>

                {/* Settings Used Summary */}
                <div className="flex flex-wrap gap-1.5">
                  {settings.encryptStrings && (
                    <span className="px-2 py-0.5 rounded-lg bg-[var(--accent-10)] text-[9px] font-mono text-[var(--accent-strong)]">encryptStrings</span>
                  )}
                  {settings.proxifyLocals && (
                    <span className="px-2 py-0.5 rounded-lg bg-[var(--accent-10)] text-[9px] font-mono text-[var(--accent-strong)]">proxifyLocals</span>
                  )}
                  {settings.proxifyFunctions && (
                    <span className="px-2 py-0.5 rounded-lg bg-[var(--accent-10)] text-[9px] font-mono text-[var(--accent-strong)]">proxifyFunctions</span>
                  )}
                  {settings.antiTamper && (
                    <span className="px-2 py-0.5 rounded-lg bg-[var(--accent-10)] text-[9px] font-mono text-[var(--accent-strong)]">antiTamper</span>
                  )}
                  {settings.controlFlowFlattening && (
                    <span className="px-2 py-0.5 rounded-lg bg-[var(--accent-10)] text-[9px] font-mono text-[var(--accent-strong)]">controlFlow</span>
                  )}
                  {settings.isLuauRuntime && (
                    <span className="px-2 py-0.5 rounded-lg bg-[var(--accent-10)] text-[9px] font-mono text-[var(--accent-strong)]">luauRuntime</span>
                  )}
                  <span className="px-2 py-0.5 rounded-lg bg-[var(--accent-10)] text-[9px] font-mono text-[var(--accent-strong)]">vmDepth={settings.loaderVMDepth}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible History Drawer */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-2.5 text-xs font-semibold text-[var(--text-80)] transition hover:border-[var(--accent-30)] hover:text-[var(--accent-strong)] hover:bg-[var(--surface)]"
          >
            <FileCode className="w-4 h-4 text-[var(--accent-soft)]" />
            <span>Riwayat Obfuscation</span>
            {history.length > 0 && (
              <span className="rounded-full bg-[var(--accent-15)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-strong)]">
                {history.length}
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-[var(--text-45)] transition-transform duration-300 ${historyOpen ? 'rotate-180 text-[var(--accent)]' : ''}`}
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
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-[var(--accent)]" />
                    <h3 className="text-sm font-bold text-[var(--text)]">Riwayat Obfuscation</h3>
                  </div>
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Hapus seluruh riwayat obfuscation?')) {
                          saveHistory([]);
                          toast('Riwayat obfuscation dibersihkan', 'info');
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--line)] text-[11px] font-medium text-[var(--text-50)] hover:text-[var(--danger)] hover:border-red-500/30 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      Hapus Semua
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-40)]">
                    Belum ada riwayat obfuscation. Script yang Anda obfuscate akan otomatis tersimpan di sini.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {history.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-3 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] hover:bg-[var(--surface)] transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-[var(--text-90)] truncate max-w-xs">
                              {rec.title}
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
                            <span>{rec.originalLines} → {rec.obfuscatedLines} Baris</span>
                            <span>•</span>
                            <span>{rec.executionTimeMs}ms</span>
                            <span>•</span>
                            <span>VM Depth {rec.settings.loaderVMDepth}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLoadFromHistory(rec)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-15)] text-[11px] font-bold text-[var(--accent-strong)] hover:bg-[var(--accent-20)] transition"
                          >
                            <Eye className="w-3 h-3" />
                            Buka
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(rec.outputCode);
                              toast('Output disalin', 'success');
                            }}
                            className="p-1.5 rounded-lg border border-[var(--line)] text-[var(--text-60)] hover:text-[var(--text)] transition"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const blob = new Blob([rec.outputCode], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `obfuscated_${rec.id}.lua`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="p-1.5 rounded-lg border border-[var(--line)] text-[var(--text-60)] hover:text-[var(--text)] transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              saveHistory(history.filter((r) => r.id !== rec.id));
                            }}
                            className="p-1.5 rounded-lg text-[var(--text-35)] hover:text-[var(--danger)] transition"
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
