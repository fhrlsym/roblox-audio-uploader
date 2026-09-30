'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToast } from './Toast';
import { Activity, Database, KeyRound, RefreshCw, Server, Settings, HardDrive, Zap, ScrollText, Trash2 } from 'lucide-react';

interface DevPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentPin: string;
  onPinChanged: (pin: string) => void;
}

interface LogEntry {
  id: number;
  level: 'info' | 'warn' | 'error' | string;
  message: string;
  timestamp: string;
}

interface HealthData {
  backend: {
    ok: boolean;
    status?: string;
    uptimeSeconds?: number;
    startedAt?: string;
    versions?: { node?: string; ytdlp?: string; ffmpeg?: string };
    resources?: {
      disk?: { type?: string; totalBytes?: number; freeBytes?: number; usedBytes?: number; fileCount?: number };
      tempFiles?: { temp: number; output: number; upload: number };
      memory?: { rssMB?: number; heapUsedMB?: number; heapTotalMB?: number };
    };
    uploadQueue?: { pending: number; active: number; maxConcurrency?: number } | null;
    flags?: { youtubeCookies?: boolean; youtubeCookieJars?: number; potProvider?: boolean };
    cached?: boolean;
    ageSeconds?: number;
    error?: string;
  };
  supabase: {
    ok: boolean;
    audioUploads?: number;
    savedAccounts?: number;
    error?: string;
  };
  frontend?: {
    vercelUrl?: string | null;
    env?: string;
  };
}

function fmtUptime(seconds?: number) {
  if (!seconds && seconds !== 0) return '-';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtBytes(bytes?: number) {
  if (!bytes && bytes !== 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function StatRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-50)]">{label}</span>
      <span className={`font-mono text-xs font-bold ${ok === false ? 'text-[var(--danger)]' : ok === true ? 'text-[var(--emerald)]' : 'text-[var(--text)]'}`}>
        {value}
      </span>
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="brutal-card-sm p-4">
      <div className="mb-3 flex items-center gap-2 border-b-2 border-[var(--text)] pb-2">
        {icon}
        <h3 className="text-xs font-extrabold uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function DevPanel({ isOpen, onClose, currentPin, onPinChanged }: DevPanelProps) {
  const { toast } = useToast();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [pinInput, setPinInput] = useState(currentPin);
  const [savingPin, setSavingPin] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logLevel, setLogLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [logAutoScroll, setLogAutoScroll] = useState(true);
  const lastLogIdRef = useRef(0);
  const logBoxRef = useRef<HTMLDivElement>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dev/health', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/dev/logs?since=0&limit=500', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const incoming: LogEntry[] = Array.isArray(data.logs) ? data.logs : [];
      setLogs(incoming);
      if (incoming.length > 0) lastLogIdRef.current = incoming[incoming.length - 1].id;
    } catch {
      // ignore; next poll retries
    }
  }, []);

  const clearLogs = useCallback(async () => {
    try {
      await fetch('/api/dev/logs', { method: 'DELETE' });
      setLogs([]);
      lastLogIdRef.current = 0;
      toast('Log dibersihkan', 'success');
    } catch {
      toast('Gagal membersihkan log', 'error');
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
      fetchLogs();
      const healthTimer = setInterval(fetchHealth, 15000);
      const logTimer = setInterval(fetchLogs, 4000);
      return () => {
        clearInterval(healthTimer);
        clearInterval(logTimer);
      };
    }
  }, [isOpen, fetchHealth, fetchLogs]);

  // Keep the log view pinned to the newest entry unless the user scrolled up.
  useEffect(() => {
    if (logAutoScroll && logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs, logAutoScroll, logLevel]);

  // Keep the PIN field in sync with the active PIN when the panel opens.
  useEffect(() => {
    if (isOpen) setPinInput(currentPin);
  }, [isOpen, currentPin]);

  const handleSavePin = async () => {
    if (pinInput.length < 4) {
      toast('PIN minimal 4 karakter', 'error');
      return;
    }
    setSavingPin(true);
    try {
      const res = await fetch('/api/dev/pin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onPinChanged(pinInput);
        toast('PIN berhasil diganti', 'success');
      } else {
        toast(data.error || 'Gagal ganti PIN', 'error');
      }
    } catch {
      toast('Gagal ganti PIN', 'error');
    } finally {
      setSavingPin(false);
    }
  };

  const b = health?.backend;
  const s = health?.supabase;

  const filteredLogs = logLevel === 'all' ? logs : logs.filter((l) => l.level === logLevel);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Developer Panel" size="xl" icon={<Settings className="h-5 w-5" />}>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-50)]">
            {b?.cached ? `Cached ${b.ageSeconds}s ago` : 'Live'} · Auto-refresh 15s
          </p>
          <Button size="sm" variant="ghost" onClick={fetchHealth} loading={loading} loadingText="Refreshing...">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Backend Status */}
          <SectionCard icon={<Server className="h-4 w-4" />} title="Backend Railway">
            <StatRow label="Status" value={b?.ok ? 'Online' : 'Offline'} ok={b?.ok} />
            <StatRow label="Uptime" value={fmtUptime(b?.uptimeSeconds)} />
            <StatRow label="Started" value={b?.startedAt ? new Date(b.startedAt).toLocaleString('id-ID') : '-'} />
            <StatRow label="yt-dlp" value={b?.versions?.ytdlp || 'N/A'} />
            <StatRow label="ffmpeg" value={b?.versions?.ffmpeg?.split(' ')[0] || 'N/A'} />
            <StatRow label="YT Cookies" value={b?.flags?.youtubeCookieJars ? `${b.flags.youtubeCookieJars} jar` : (b?.flags?.youtubeCookies ? 'Set' : 'Missing')} ok={b?.flags?.youtubeCookies} />
          </SectionCard>

          {/* Resources */}
          <SectionCard icon={<HardDrive className="h-4 w-4" />} title="Resources">
            <StatRow label="Memory RSS" value={b?.resources?.memory ? `${b.resources.memory.rssMB} MB` : '-'} />
            <StatRow label="Heap Used" value={b?.resources?.memory ? `${b.resources.memory.heapUsedMB} / ${b.resources.memory.heapTotalMB} MB` : '-'} />
            <StatRow label="Temp Files" value={b?.resources?.tempFiles ? `${b.resources.tempFiles.temp + b.resources.tempFiles.output}` : '-'} />
            <StatRow label="Upload Files" value={b?.resources?.tempFiles?.upload?.toString() || '-'} />
            {b?.resources?.disk?.type === 'statfs' && (
              <>
                <StatRow label="Disk Used" value={fmtBytes(b.resources.disk.usedBytes)} />
                <StatRow label="Disk Free" value={fmtBytes(b.resources.disk.freeBytes)} />
              </>
            )}
            {b?.resources?.disk?.type === 'approx' && (
              <StatRow label="Backend Files" value={`${b.resources.disk.fileCount} files · ${fmtBytes(b.resources.disk.totalBytes)}`} />
            )}
          </SectionCard>

          {/* Upload Queue */}
          <SectionCard icon={<Zap className="h-4 w-4" />} title="Upload Queue">
            <StatRow label="Pending" value={b?.uploadQueue?.pending?.toString() || '0'} />
            <StatRow label="Active" value={b?.uploadQueue?.active?.toString() || '0'} />
            <StatRow label="Max Concurrent" value={b?.uploadQueue?.maxConcurrency?.toString() || '2'} />
            <div className="mt-2 rounded-md border-2 border-[var(--text)] bg-[var(--bg)] p-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-50)]">How it works</p>
              <p className="mt-1 text-[10px] text-[var(--text-60)]">
                Upload ke Roblox di-limit max 2 concurrent + 1.5s spacing untuk hindari throttle.
              </p>
            </div>
          </SectionCard>

          {/* Supabase */}
          <SectionCard icon={<Database className="h-4 w-4" />} title="Supabase">
            <StatRow label="Connection" value={s?.ok ? 'Connected' : 'Error'} ok={s?.ok} />
            <StatRow label="Audio Records" value={s?.audioUploads?.toString() || '0'} />
            <StatRow label="Saved Accounts" value={s?.savedAccounts?.toString() || '0'} />
          </SectionCard>
        </div>

        {/* PIN Management */}
        <div className="brutal-card-sm p-4">
          <div className="mb-3 flex items-center gap-2 border-b-2 border-[var(--text)] pb-2">
            <KeyRound className="h-4 w-4" />
            <h3 className="text-xs font-extrabold uppercase tracking-wide">PIN Management</h3>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[var(--text-50)]">
                Access PIN
              </label>
              <input
                type="text"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full rounded-lg border-2 border-[var(--text)] bg-[var(--bg)] px-4 py-2.5 font-mono text-sm font-semibold outline-none transition-colors focus:border-[var(--accent)]"
                placeholder="Enter PIN"
              />
            </div>
            <Button onClick={handleSavePin} loading={savingPin} loadingText="Saving...">
              Save PIN
            </Button>
          </div>
          <p className="mt-2 text-[10px] text-[var(--text-50)]">
            PIN disimpan di Supabase (table <code className="font-mono">app_settings</code>). Override env var <code className="font-mono">NEXT_PUBLIC_PIN</code>.
          </p>
        </div>

        {/* Backend Logs */}
        <div className="brutal-card-sm p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--text)] pb-2">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              <h3 className="text-xs font-extrabold uppercase tracking-wide">Backend Logs</h3>
              <span className="text-[10px] font-bold text-[var(--text-50)]">({filteredLogs.length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 rounded-lg border-2 border-[var(--text)] bg-[var(--bg)] p-0.5">
                {(['all', 'info', 'warn', 'error'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLogLevel(lvl)}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition ${
                      logLevel === lvl
                        ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                        : 'text-[var(--text-60)] hover:text-[var(--text)]'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setLogAutoScroll((v) => !v)}
                className={`rounded-md border-2 border-[var(--text)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                  logAutoScroll ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--bg)] text-[var(--text-60)]'
                }`}
                title="Auto-scroll ke log terbaru"
              >
                Auto
              </button>
              <button
                onClick={fetchLogs}
                className="rounded-md border-2 border-[var(--text)] bg-[var(--bg)] p-1 text-[var(--text)] transition hover:bg-[var(--accent)] hover:text-[var(--on-accent)]"
                title="Refresh log"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={clearLogs}
                className="rounded-md border-2 border-[var(--text)] bg-[var(--bg)] p-1 text-[var(--danger)] transition hover:bg-[var(--danger)] hover:text-white"
                title="Bersihkan log"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div
            ref={logBoxRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
              setLogAutoScroll(atBottom);
            }}
            className="max-h-72 overflow-y-auto rounded-lg border-2 border-[var(--text)] bg-[var(--bg)] p-2 font-mono text-[10.5px] leading-relaxed"
          >
            {filteredLogs.length === 0 ? (
              <p className="py-6 text-center font-sans text-xs font-bold uppercase tracking-wide text-[var(--text-40)]">
                Belum ada log. Lakukan convert YouTube lalu refresh.
              </p>
            ) : (
              filteredLogs.map((entry) => (
                <div key={entry.id} className="flex gap-2 border-b border-[var(--text-30)] py-0.5 last:border-0">
                  <span className="shrink-0 text-[var(--text-40)]">
                    {new Date(entry.timestamp).toLocaleTimeString('id-ID')}
                  </span>
                  <span
                    className={`shrink-0 font-bold uppercase ${
                      entry.level === 'error'
                        ? 'text-[var(--danger)]'
                        : entry.level === 'warn'
                          ? 'text-amber-500'
                          : 'text-[var(--accent)]'
                    }`}
                  >
                    {entry.level}
                  </span>
                  <span className="whitespace-pre-wrap break-all text-[var(--text-80)]">{entry.message}</span>
                </div>
              ))
            )}
          </div>
          <p className="mt-2 text-[10px] text-[var(--text-50)]">
            Log in-memory di backend (maks 500 baris terakhir). Ikut ter-reset saat deploy/restart.
          </p>
        </div>

        {/* Frontend info */}
        <div className="flex items-center gap-2 rounded-md border-2 border-[var(--text)] bg-[var(--bg)] px-3 py-2">
          <Activity className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-50)]">Frontend:</span>
          <span className="font-mono text-[10px] font-bold text-[var(--text)]">
            {health?.frontend?.env || 'development'} · {health?.frontend?.vercelUrl || 'localhost'}
          </span>
        </div>
      </div>
    </Modal>
  );
}
