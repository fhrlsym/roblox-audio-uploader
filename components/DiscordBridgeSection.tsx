'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Download, Loader2, MessageSquare, Plus, Trash2, X } from 'lucide-react';
import { CARD, INPUT, BTN_PRIMARY, BTN_GHOST } from '../lib/ui';
import { useToast } from './Toast';

interface DiscordBridgeSectionProps {
  backendUrl: string;
}

interface Job {
  assetId: string;
  createdAt: number;
  status: 'waiting' | 'ready' | 'unknown';
  file: { fileName: string; filePath: string; size: number } | null;
  message?: string;
}

const QUEUE_KEY = 'audioUploader_discordBridgeQueue';

export default function DiscordBridgeSection({ backendUrl }: DiscordBridgeSectionProps) {
  const { toast } = useToast();
  const [assetInput, setAssetInput] = useState('');
  const [queue, setQueue] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [bridgeStatus, setBridgeStatus] = useState<{ connected: boolean; channel: string | null; error: string | null; ready: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore queue
  useEffect(() => {
    try {
      const saved = localStorage.getItem(QUEUE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed)) setQueue(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (queue.length > 0) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      else localStorage.removeItem(QUEUE_KEY);
    } catch {}
  }, [queue]);

  // Fetch bridge status
  const fetchStatus = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/discord-bridge/status`, { cache: 'no-store' });
      if (res.ok) setBridgeStatus(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl]);

  // Poll jobs status
  useEffect(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    if (queue.length > 0) {
      pollTimer.current = setInterval(pollAll, 3000);
    }
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  const pollAll = async () => {
    for (const id of queue) {
      try {
        const res = await fetch(`${backendUrl}/api/discord-bridge/status/${id}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setJobs((prev) => ({ ...prev, [id]: data }));
        }
      } catch {}
    }
  };

  const addToQueue = async () => {
    const clean = String(assetInput).replace(/\D/g, '');
    if (!clean) {
      toast('Masukkan Asset ID Roblox yang valid', 'error');
      return;
    }
    if (queue.includes(clean)) {
      toast('Asset ID sudah ada di antrian', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/discord-bridge/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat permintaan');
      setQueue((prev) => [clean, ...prev]);
      setJob(clean, data);
      setAssetInput('');
      toast(`Perintah dikirim ke Discord untuk asset ${clean}. Menunggu file...`, 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal membuat permintaan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const setJob = (id: string, data: Job) => {
    setJobs((prev) => ({ ...prev, [id]: data }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addToQueue();
    }
  };

  const removeFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((q) => q !== id));
    setJobs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    fetch(`${backendUrl}/api/discord-bridge/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  const clearQueue = () => {
    setQueue([]);
    setJobs({});
  };

  const copyCommand = (id: string) => {
    const cmd = `/download asset_id:${id}`;
    navigator.clipboard.writeText(cmd);
    toast('Perintah Discord disalin! Tempel di channel Discord.', 'success');
  };

  const downloadFile = (id: string) => {
    window.open(`${backendUrl}/api/discord-bridge/download/${id}`, '_blank');
  };

  const readyCount = queue.filter((id) => jobs[id]?.status === 'ready').length;

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className={`${CARD} p-4 text-center`}>
          <p className="text-[11px] font-medium text-[var(--text-45)] uppercase tracking-wider">Permintaan</p>
          <p className="text-2xl font-bold text-[var(--text)] mt-1">{queue.length}</p>
        </div>
        <div className={`${CARD} p-4 text-center`}>
          <p className="text-[11px] font-medium text-[var(--text-45)] uppercase tracking-wider">Siap Unduh</p>
          <p className="text-2xl font-bold text-[var(--emerald)] mt-1">{readyCount}</p>
        </div>
        <div className={`${CARD} p-4 text-center`}>
          <p className="text-[11px] font-medium text-[var(--text-45)] uppercase tracking-wider">Bridge Bot</p>
          <p className={`text-xl font-bold mt-1 ${bridgeStatus?.connected ? 'text-[var(--emerald)]' : 'text-rose-300'}`}>
            {bridgeStatus?.connected ? 'Terhubung' : 'Offline'}
          </p>
          {bridgeStatus?.channel && (
            <p className="text-[10px] text-[var(--text-40)] mt-0.5 truncate">#{bridgeStatus.channel}</p>
          )}
        </div>
      </div>

      {/* Workbench */}
      <div className={`${CARD} p-6 space-y-5`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--accent-15)] flex items-center justify-center text-[var(--accent)]">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text)] tracking-tight">Discord Bridge Bot</h2>
            <p className="text-xs text-[var(--text-45)]">
              Masukkan Asset ID → bot kirim perintah ke Discord → Sound Downloader unduh → file diteruskan otomatis ke web
            </p>
          </div>
        </div>

        {!bridgeStatus?.connected && (
          <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs text-amber-200/90">
            Bridge bot belum terhubung. Pastikan <code className="font-mono">DISCORD_BOT_TOKEN</code> dan{' '}
            <code className="font-mono">DISCORD_CHANNEL_ID</code> sudah di-set di backend.
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={assetInput}
            onChange={(e) => setAssetInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Masukkan Asset ID Roblox lalu Enter…"
            className={INPUT}
            disabled={loading}
          />
          <button
            onClick={addToQueue}
            disabled={loading || !assetInput.trim()}
            className={`${BTN_GHOST} shrink-0 px-3`}
            title="Tambah Asset ID"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Queue list */}
        {queue.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--text-60)] font-medium">Antrian Asset ({queue.length})</p>
              <button onClick={clearQueue} className="text-[11px] text-[var(--text-40)] hover:text-rose-300 transition">
                Hapus semua
              </button>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              <AnimatePresence initial={false}>
                {queue.map((id) => {
                  const job = jobs[id];
                  const status = job?.status || 'unknown';
                  return (
                    <motion.div
                      key={id}
                      layout
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <code className="min-w-0 flex-1 font-mono text-[var(--text-80)]">{id}</code>
                        {status === 'ready' ? (
                          <span className="flex items-center gap-1 rounded-md bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                            <Check className="w-3 h-3" /> Siap
                          </span>
                        ) : status === 'waiting' ? (
                          <span className="flex items-center gap-1 rounded-md bg-[var(--accent-15)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--accent-strong)]">
                            <Loader2 className="w-3 h-3 animate-spin" /> Menunggu
                          </span>
                        ) : (
                          <span className="rounded-md bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--text-40)]">
                            Baru
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {status === 'ready' && job?.file ? (
                          <button
                            onClick={() => downloadFile(id)}
                            className={`${BTN_PRIMARY} text-[11px] px-2.5 py-1.5`}
                          >
                            <Download className="w-3 h-3" />
                            Unduh ({job.file.fileName})
                          </button>
                        ) : (
                          <button
                            onClick={() => copyCommand(id)}
                            className={`${BTN_GHOST} text-[11px] px-2.5 py-1.5`}
                          >
                            <Copy className="w-3 h-3" />
                            Copy /download
                          </button>
                        )}
                        <button
                          onClick={() => removeFromQueue(id)}
                          className="p-1.5 text-[var(--text-40)] transition hover:text-rose-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {status !== 'ready' && (
                        <p className="mt-2 text-[11px] text-[var(--text-40)]">
                          Perintah otomatis dikirim ke Discord. Menunggu bot mengirim file...
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {queue.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center">
            <MessageSquare className="w-8 h-8 mx-auto text-[var(--text-30)]" />
            <p className="mt-2 text-xs text-[var(--text-45)]">
              Belum ada asset. Masukkan Asset ID Roblox untuk mulai.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}