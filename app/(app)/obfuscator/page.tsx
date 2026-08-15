'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Shield, Play, Copy, Trash2, Settings2, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Slider } from '../../../components/ui/slider';
import { ObfuscatorService, type ObfuscatorSettings } from '../../../lib/services/obfuscator.service';
import { useUIStore } from '../../../lib/stores/uiStore';

const PRESETS: { name: string; settings: ObfuscatorSettings }[] = [
  { name: 'Roblox Studio', settings: { encryptStrings: false, proxifyLocals: false, proxifyFunctions: false, antiTamper: false, controlFlowFlattening: false, isLuauRuntime: true, vmDepth: 0 } },
  { name: 'Light', settings: { encryptStrings: true, proxifyLocals: true, proxifyFunctions: false, antiTamper: false, controlFlowFlattening: false, isLuauRuntime: true, vmDepth: 0 } },
  { name: 'Standard', settings: { encryptStrings: true, proxifyLocals: true, proxifyFunctions: true, antiTamper: false, controlFlowFlattening: true, isLuauRuntime: true, vmDepth: 2 } },
  { name: 'Heavy', settings: { encryptStrings: true, proxifyLocals: true, proxifyFunctions: true, antiTamper: true, controlFlowFlattening: true, isLuauRuntime: true, vmDepth: 3 } },
  { name: 'Maximum', settings: { encryptStrings: true, proxifyLocals: true, proxifyFunctions: true, antiTamper: true, controlFlowFlattening: true, isLuauRuntime: true, vmDepth: 5 } },
];

const SAMPLE_SCRIPTS: { name: string; code: string }[] = [
  {
    name: 'Hello World',
    code: 'print("Hello, World!")',
  },
  {
    name: 'ESP Script',
    code: 'local Players = game:GetService("Players")\nlocal RunService = game:GetService("RunService")\n\nlocal function createESP(player)\n\tlocal character = player.Character\n\tif not character then return end\n\t\n\tlocal highlight = Instance.new("Highlight")\n\thighlight.FillColor = Color3.new(1, 0, 0)\n\thighlight.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop\n\thighlight.Parent = character\nend\n\nfor _, player in ipairs(Players:GetPlayers()) do\n\tif player ~= Players.LocalPlayer then\n\t\tcreateESP(player)\n\tend\nend\n\nPlayers.PlayerAdded:Connect(createESP)',
  },
  {
    name: 'Script Hub',
    code: '-- Script Hub Loader\nlocal loader = {}\n\nfunction loader:load(url)\n\tlocal success, result = pcall(function()\n\t\treturn game:HttpGet(url)\n\tend)\n\t\n\tif success then\n\t\tloadstring(result)()\n\telse\n\t\twarn("Failed to load script: " .. tostring(result))\n\tend\nend\n\nreturn loader',
  },
];

export default function ObfuscatorPage() {
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [execTime, setExecTime] = useState(0);
  const [history, setHistory] = useState<{ code: string; output: string; preset: string; time: number; date: string }[]>([]);
  const addToast = useUIStore((s) => s.addToast);

  const [settings, setSettings] = useState<ObfuscatorSettings>({
    encryptStrings: true,
    proxifyLocals: true,
    proxifyFunctions: true,
    antiTamper: false,
    controlFlowFlattening: true,
    isLuauRuntime: true,
    vmDepth: 2,
  });

  const activePreset = useMemo(() => {
    const match = PRESETS.find(
      (p) =>
        p.settings.encryptStrings === settings.encryptStrings &&
        p.settings.proxifyLocals === settings.proxifyLocals &&
        p.settings.proxifyFunctions === settings.proxifyFunctions &&
        p.settings.antiTamper === settings.antiTamper &&
        p.settings.controlFlowFlattening === settings.controlFlowFlattening &&
        p.settings.isLuauRuntime === settings.isLuauRuntime &&
        p.settings.vmDepth === settings.vmDepth
    );
    return match?.name || 'Custom';
  }, [settings]);

  const toggleSetting = (key: keyof ObfuscatorSettings) => {
    if (typeof settings[key] === 'boolean') {
      setSettings({ ...settings, [key]: !settings[key] });
    }
  };

  const handleRun = async () => {
    if (!code.trim()) return;
    setRunning(true);
    setOutput('');

    try {
      const result = await ObfuscatorService.obfuscate(code, settings);
      setOutput(result.result);
      setExecTime(result.executionTimeMs);
      setHistory([
        { code, output: result.result, preset: activePreset, time: result.executionTimeMs, date: new Date().toLocaleString() },
        ...history.slice(0, 29),
      ]);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Obfuscation failed', 'error');
    }
    setRunning(false);
  };

  const clearHistory = () => setHistory([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-[var(--text)]">Obfuscator</h1>
        <p className="text-xs text-[var(--text-50)]">Protect your Luau/Lua scripts</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Button onClick={handleRun} loading={running} disabled={!code.trim()}>
                <Play size={14} />
                Obfuscate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings2 size={14} />
                Settings
                <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-[var(--accent-10)] text-[var(--accent-strong)]">{activePreset}</span>
              </Button>
            </div>

            {showSettings && (
              <div className="rounded-xl bg-[var(--surface-soft)] p-4 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['encryptStrings', 'proxifyLocals', 'proxifyFunctions', 'antiTamper', 'controlFlowFlattening', 'isLuauRuntime'] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => toggleSetting(key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition ${
                        settings[key]
                          ? 'border-[var(--accent-30)] bg-[var(--accent-10)] text-[var(--accent-strong)]'
                          : 'border-[var(--line)] text-[var(--text-50)] hover:border-[var(--accent-25)]'
                      }`}
                    >
                      {settings[key] ? <Eye size={14} /> : <EyeOff size={14} />}
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </button>
                  ))}
                </div>
                <Slider
                  label="VM Depth"
                  min={0}
                  max={5}
                  step={1}
                  value={settings.vmDepth || 0}
                  onChange={(v) => setSettings({ ...settings, vmDepth: v })}
                  formatValue={(v) => `${v}`}
                />
                <div className="flex gap-1.5 flex-wrap">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => setSettings(p.settings)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition ${
                        activePreset === p.name
                          ? 'border-[var(--accent-30)] bg-[var(--accent-10)] text-[var(--accent-strong)]'
                          : 'border-[var(--line)] text-[var(--text-50)] hover:border-[var(--accent-25)]'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-45)]">Input Script</label>
                  <div className="flex gap-1">
                    {SAMPLE_SCRIPTS.map((s) => (
                      <button
                        key={s.name}
                        onClick={() => setCode(s.code)}
                        className="px-2 py-1 rounded text-[9px] font-medium border border-[var(--line)] text-[var(--text-40)] hover:text-[var(--text)] hover:border-[var(--accent-25)] transition"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your script here..."
                  className="w-full h-[300px] bg-[var(--surface-focus)] text-[var(--text)] rounded-xl p-4 border border-[var(--line)] text-xs font-mono leading-relaxed outline-none focus:border-[var(--accent-40)] focus:ring-2 focus:ring-[var(--accent-20)] resize-none placeholder:text-[var(--text-35)]"
                  spellCheck={false}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-45)]">Output</label>
                  {output && (
                    <button
                      onClick={() => navigator.clipboard.writeText(output)}
                      className="p-1 rounded hover:bg-[var(--surface-strong)] text-[var(--text-40)]"
                    >
                      <Copy size={14} />
                    </button>
                  )}
                </div>
                <textarea
                  value={output || '// Obfuscated output will appear here...'}
                  readOnly
                  className="w-full h-[300px] bg-[var(--surface-focus)] text-[var(--text)] rounded-xl p-4 border border-[var(--line)] text-xs font-mono leading-relaxed resize-none outline-none"
                  spellCheck={false}
                />
              </div>
            </div>

            {execTime > 0 && (
              <div className="text-[10px] text-[var(--text-45)]">
                Completed in <strong className="text-[var(--text)]">{execTime}ms</strong> · Lines: <strong className="text-[var(--text)]">{output.split('\n').length}</strong>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-60)]">History</h2>
          {history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              <Trash2 size={14} />
              Clear
            </Button>
          )}
        </div>
        <Card>
          <CardContent className="p-4">
            {history.length === 0 ? (
              <p className="text-xs text-[var(--text-40)] text-center py-4">No obfuscation history yet</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {history.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface)] transition text-xs">
                    <Shield size={12} className="text-[var(--text-35)] shrink-0" />
                    <span className="text-[var(--text-60)] font-medium">{item.preset}</span>
                    <span className="text-[var(--text-35)]">{item.time}ms</span>
                    <span className="text-[var(--text-35)] ml-auto">{item.date}</span>
                    <button
                      onClick={() => { setCode(item.code); setOutput(item.output); }}
                      className="p-1 rounded hover:bg-[var(--surface-strong)] text-[var(--text-35)]"
                    >
                      <Play size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}