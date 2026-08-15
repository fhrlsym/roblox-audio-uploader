'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileCode, Play, Copy, Trash2, Zap, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { DumperService } from '../../../lib/services/dumper.service';
import { useUIStore } from '../../../lib/stores/uiStore';
import { useDumperHistory, useAddDumperRecord, useDeleteDumperRecord, useClearDumperHistory } from '../../../lib/queries/useDumperHistory';

const SAMPLE_SCRIPTS: { name: string; code: string }[] = [
  {
    name: 'Luraph v14',
    code: '-- Luraph v14 obfuscated\nlocal a,b,c,d=string.byte,string.char,string.sub,table.concat;local e,f,g;e,f,g=...',
  },
  {
    name: 'Byte Array',
    code: 'loadstring(string.char(72,101,108,108,111,32,87,111,114,108,100))()',
  },
  {
    name: 'HTTP Loader',
    code: '-- http loader example\nlocal req = syn.request({\n  Url = "https://pastebin.com/raw/xxxxx",\n  Method = "GET"\n})\nloadstring(req.Body)()',
  },
];

export default function DumperPage() {
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [detection, setDetection] = useState<{ engine: string; confidence: number } | null>(null);
  const [engine, setEngine] = useState('auto');
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'output' | 'logs' | 'constants'>('output');
  const [logs, setLogs] = useState<string[]>([]);
  const [constants, setConstants] = useState<Record<string, unknown>>({});
  const [execTime, setExecTime] = useState(0);
  const addToast = useUIStore((s) => s.addToast);
  const { data: history } = useDumperHistory();
  const addRecord = useAddDumperRecord();
  const deleteRecord = useDeleteDumperRecord();
  const clearHistory = useClearDumperHistory();

  const handleDetect = useCallback(async () => {
    if (!code.trim()) return;
    try {
      const result = await DumperService.detect(code);
      setDetection({ engine: result.engine, confidence: result.confidence });
    } catch {
      setDetection(null);
    }
  }, [code]);

  const handleRun = async () => {
    if (!code.trim()) return;
    setRunning(true);
    setOutput('');
    setLogs([]);
    setConstants({});
    setActiveTab('output');

    try {
      const result = await DumperService.run(code, engine === 'auto' ? undefined : engine);
      setOutput(result.deobfuscatedCode);
      setLogs(result.httpLogs || []);
      setConstants((result.constants || {}) as Record<string, unknown>);
      setExecTime(result.executionTimeMs || 0);
      addRecord.mutate({
        code,
        output: result.deobfuscatedCode,
        engineUsed: result.engineUsed,
        executionTimeMs: result.executionTimeMs,
      });
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Dump failed', 'error');
    }
    setRunning(false);
  };

  const loadFromHistory = (record: { code: string; output: string }) => {
    setCode(record.code);
    setOutput(record.output);
    setActiveTab('output');
  };

  const engineOptions = [
    { value: 'auto', label: 'Auto Detect' },
    { value: 'larry', label: 'Larry Universal' },
    { value: '45ms', label: '45ms' },
    { value: 'unveilr', label: 'UnveilR' },
    { value: 'ironveil', label: 'IronVeil' },
    { value: 'moonveil', label: 'Moonveil' },
    { value: 'prometheus', label: 'Prometheus' },
    { value: 'ironbrew', label: 'IronBrew' },
    { value: 'static', label: 'Static Analysis' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-[var(--text)]">Script Dumper</h1>
        <p className="text-xs text-[var(--text-50)]">Deobfuscate Luau/Lua scripts</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex gap-2">
              <Select
                options={engineOptions}
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
                className="w-40"
              />
              <Button onClick={handleDetect} variant="secondary" size="sm" disabled={!code.trim()}>
                <Zap size={14} />
                Detect
              </Button>
              <Button onClick={handleRun} loading={running} disabled={!code.trim()}>
                <Play size={14} />
                Run
              </Button>
            </div>

            {detection && (
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 size={12} className="text-emerald-400" />
                <span className="text-[var(--text-60)]">Detected: <strong className="text-[var(--text)]">{detection.engine}</strong></span>
                <span className="text-[var(--text-35)]">({(detection.confidence * 100).toFixed(0)}% confidence)</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
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
                  placeholder="Paste your obfuscated script here..."
                  className="w-full h-[300px] bg-[var(--surface-focus)] text-[var(--text)] rounded-xl p-4 border border-[var(--line)] text-xs font-mono leading-relaxed outline-none focus:border-[var(--accent-40)] focus:ring-2 focus:ring-[var(--accent-20)] resize-none placeholder:text-[var(--text-35)]"
                  spellCheck={false}
                />
              </div>

              <div className="lg:col-span-3">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-45)]">Output</label>
                  <div className="flex gap-1">
                    {(['output', 'logs', 'constants'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition ${
                          activeTab === tab
                            ? 'bg-[var(--accent-12)] text-[var(--accent-strong)]'
                            : 'text-[var(--text-40)] hover:text-[var(--text)]'
                        }`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                  {output && (
                    <button
                      onClick={() => navigator.clipboard.writeText(output)}
                      className="ml-auto p-1 rounded hover:bg-[var(--surface-strong)] text-[var(--text-40)]"
                    >
                      <Copy size={14} />
                    </button>
                  )}
                </div>
                <div className="w-full h-[300px] bg-[var(--surface-focus)] rounded-xl border border-[var(--line)] overflow-hidden">
                  {activeTab === 'output' && (
                    <textarea
                      value={output || '// Output will appear here...'}
                      readOnly
                      className="w-full h-full bg-transparent text-[var(--text)] p-4 text-xs font-mono leading-relaxed resize-none outline-none placeholder:text-[var(--text-35)]"
                      spellCheck={false}
                    />
                  )}
                  {activeTab === 'logs' && (
                    <div className="p-4 h-full overflow-y-auto">
                      {logs.length === 0 ? (
                        <p className="text-xs text-[var(--text-35)]">No HTTP logs captured</p>
                      ) : (
                        logs.map((log, i) => (
                          <div key={i} className="text-xs text-[var(--text-60)] font-mono py-0.5">{log}</div>
                        ))
                      )}
                    </div>
                  )}
                  {activeTab === 'constants' && (
                    <div className="p-4 h-full overflow-y-auto">
                      {Object.keys(constants).length === 0 ? (
                        <p className="text-xs text-[var(--text-35)]">No constants extracted</p>
                      ) : (
                        Object.entries(constants).map(([k, v]) => (
                          <div key={k} className="text-xs py-0.5">
                            <span className="text-[var(--accent-strong)] font-mono">{k}</span>
                            <span className="text-[var(--text-50)]"> = </span>
                            <span className="text-[var(--text)] font-mono">{String(v).slice(0, 100)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {execTime > 0 && (
              <div className="flex items-center gap-3 text-[10px] text-[var(--text-45)]">
                <span>Completed in <strong className="text-[var(--text)]">{execTime}ms</strong></span>
                <span>·</span>
                <span>Lines: <strong className="text-[var(--text)]">{output.split('\n').length}</strong></span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-60)]">History</h2>
          {history && history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => clearHistory.mutateAsync()}>
              <Trash2 size={14} />
              Clear
            </Button>
          )}
        </div>
        <Card>
          <CardContent className="p-4">
            {!history || history.length === 0 ? (
              <p className="text-xs text-[var(--text-40)] text-center py-4">No dump history yet</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface)] transition text-xs cursor-pointer"
                  >
                    <FileCode size={12} className="text-[var(--text-35)] shrink-0" />
                    <span className="text-[var(--text-60)] font-mono flex-1 truncate">{item.engineUsed}</span>
                    <span className="text-[var(--text-35)]">{item.executionTimeMs ? `${item.executionTimeMs}ms` : ''}</span>
                    <span className="text-[var(--text-35)]">{new Date(item.createdAt).toLocaleDateString()}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRecord.mutate(item.id); }}
                      className="p-1 rounded hover:bg-[var(--surface-strong)] text-[var(--text-35)]"
                    >
                      <Trash2 size={10} />
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