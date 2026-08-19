'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CloudUpload, Copy, Download, Film, History, Loader2, Pause, Play, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { SavedAccount } from '../types/audio';
import { StatusBadge } from './StatusBadge';
import { INPUT, BTN_PRIMARY, BTN_GHOST } from '../lib/ui';
import { useToast } from './Toast';
import { useSpoofHistory } from '../hooks/useSpoofHistory';
import { Card } from './ui/Card';
import { Modal } from './ui/Modal';
import { StatCard } from './ui/StatCard';
import { Terminal } from './ui/CodeBlock';

interface QueueItem {
  id: string;
  originalAssetId: string;
}

interface SpoofJobItem {
  key: string;
  originalAssetId: string;
  name: string;
  assetType: string;
  fileName?: string;
  status: 'queued' | 'downloading' | 'downloaded' | 'failed';
  error?: string;
  newAssetId?: string;
  uploadStatus?: string;
  uploadError?: string;
}

interface SpoofJob {
  jobId: string;
  status: 'running' | 'completed' | 'partially' | 'failed';
  error?: string;
  logs: string[];
  items: SpoofJobItem[];
}

interface SpooferSectionProps {
  selectedAccount: SavedAccount | null;
  backendUrl: string;
}

type JsonRecord = Record<string, unknown>;

const QUEUE_KEY = 'audioUploader_spooferQueue';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function parseJsonResponse(res: Response): Promise<JsonRecord> {
  const raw = await res.text();
  try {
    return raw ? (JSON.parse(raw) as JsonRecord) : {};
  } catch {
    if (res.status === 404) {
      throw new Error(
        `Backend mengembalikan 404 (Not Found). Pastikan variabel NEXT_PUBLIC_BACKEND_URL di Vercel Environment Variables sudah diisi dengan URL Railway Backend Anda (contoh: https://xxx.up.railway.app).`
      );
    }
    throw new Error(
      `Backend mengembalikan respons tidak valid (status ${res.status}). Cek koneksi backend Anda.`
    );
  }
}

export default function SpooferSection({ selectedAccount, backendUrl }: SpooferSectionProps) {
  const { toast } = useToast();
  const { records, upsertRecord, clearHistory, loadSpoofHistory } = useSpoofHistory();
  const [assetInput, setAssetInput] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const effectiveBackendUrl = (backendUrl || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001').replace(/\/+$/, '');

  // Job state (download terminal + upload)
  const [job, setJob] = useState<SpoofJob | null>(null);
  const [jobOpen, setJobOpen] = useState(false);
  const [polling, setPolling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio Preview Player State
  const [playingAssetId, setPlayingAssetId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlayAudio = (assetId: string) => {
    if (playingAssetId === assetId) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingAssetId(null);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.onended = () => setPlayingAssetId(null);
        audioRef.current.onerror = () => {
          toast('Gagal memutar preview audio aset.', 'error');
          setPlayingAssetId(null);
        };
      }
      audioRef.current.src = `${effectiveBackendUrl}/api/spoof-audio-stream/${assetId}`;
      audioRef.current.play().catch(() => {
        toast('Gagal memutar audio.', 'error');
        setPlayingAssetId(null);
      });
      setPlayingAssetId(assetId);
    }
  };

  const handleDownloadAsset = (assetId: string) => {
    const downloadUrl = `${effectiveBackendUrl}/api/spoof-download/${assetId}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(`Mengunduh file aset (${assetId})...`, 'info');
  };

  const handleCloseModal = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingAssetId(null);
    }
    setJobOpen(false);
    setQueue([]);
    try {
      localStorage.removeItem(QUEUE_KEY);
    } catch {}
    loadSpoofHistory();
  };

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Restore antrian spoof dari localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(QUEUE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as QueueItem[];
        setQueue(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // Simpan antrian spoof ke localStorage
  const saveQueue = (newQueue: QueueItem[]) => {
    setQueue(newQueue);
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
    } catch {
      // ignore
    }
  };

const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setPolling(false);
  };

  useEffect(() => () => stopPolling(), []);

  const addToQueue = () => {
    const raw = assetInput.trim();
    if (!raw) return;

    const ids = raw.split(/[\n,; ]+/).map((s) => s.replace(/\D/g, '')).filter(Boolean);
    if (ids.length === 0) {
      toast('Asset ID Roblox tidak valid', 'error');
      return;
    }

    const existingIds = new Set(queue.map((q) => q.originalAssetId));
    const newItems: QueueItem[] = [];

    for (const cleanId of ids) {
      if (!existingIds.has(cleanId)) {
        newItems.push({
          id: `item_${cleanId}_${Date.now()}`,
          originalAssetId: cleanId,
        });
        existingIds.add(cleanId);
      }
    }

    if (newItems.length > 0) {
      saveQueue([...queue, ...newItems]);
      toast(`Berhasil menambahkan ${newItems.length} asset ke antrian`, 'success');
      setAssetInput('');
    } else {
      toast('Asset ID sudah ada di antrian', 'error');
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addToQueue();
    }
  };

  const removeFromQueue = (id: string) => {
    const next = queue.filter((q) => q.id !== id);
    saveQueue(next);
  };

  const clearQueue = () => saveQueue([]);

  const handleStartJob = async () => {
    if (queue.length === 0) {
      toast('Tambahkan Asset ID terlebih dahulu', 'error');
      return;
    }
    if (uploading) return;

    const assetIds = queue.map((q) => q.originalAssetId);
    setUploading(true);
    setJobOpen(true);
    toast(`Memproses ${assetIds.length} asset...`, 'info');

    try {
      const res = await fetch(`${effectiveBackendUrl}/api/spoof-direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetIds,
          creatorType: selectedAccount?.type,
          creatorId: selectedAccount?.id,
          apiKey: selectedAccount?.apiKey,
        }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(str(data?.error) || 'Gagal memproses spoof');

      const items = (Array.isArray(data.items) ? data.items : []) as unknown as SpoofJobItem[];
      const completedJob: SpoofJob = {
        jobId: `direct_${Date.now()}`,
        status: 'completed',
        logs: [`[${new Date().toLocaleTimeString()}] Spoof selesai.`],
        items,
      };
      setJob(completedJob);

      // Persis ke Supabase riwayat
      const doneItems = items.filter((it) => (it.uploadStatus === 'done' || it.newAssetId));
      for (const item of doneItems) {
        await upsertRecord({
          id: `sp_${item.newAssetId || Date.now()}_${Math.random().toString(36).slice(2)}`,
          originalAssetId: item.originalAssetId,
          newAssetId: item.newAssetId,
          title: item.name || `Asset_${item.originalAssetId}`,
          assetType: item.assetType || 'Audio',
          status: 'Active',
          createdAt: Date.now(),
        });
      }
      if (doneItems.length > 0) {
        toast(`Spoof berhasil! ${doneItems.length} Asset Baru Roblox berhasil dibuat.`, 'success');
      } else {
        toast(`Berhasil mengunduh ${items.length} file aset asli.`, 'success');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal memproses spoof';
      toast(msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast(`Berhasil menyalin ${label}!`, 'success');
  };

  const doneCount = records.filter((r) => r.status === 'Active').length;
  const stats = {
    total: records.length,
    active: records.filter((r) => r.status === 'Active').length,
    pending: records.filter((r) => r.status === 'Pending').length,
    failed: records.filter((r) => r.status === 'Failed').length,
  };

  return (
    <div className="space-y-6">
      {/* Spoofer Stats Bar */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard
          topBar
          label="Total Spoof"
          icon={<Sparkles className="w-3.5 h-3.5" />}
          value={stats.total}
        />
        <StatCard
          topBar
          tone="success"
          label="Success"
          icon={<Check className="w-3.5 h-3.5" />}
          value={stats.active}
        />
        <StatCard
          topBar
          tone="danger"
          label="Failed"
          icon={<span className="h-3.5 w-3.5 rounded-full border-2 border-[var(--danger)] shrink-0" />}
          value={stats.failed}
        />
      </div>

      {/* Workbench Form Card */}
      <Card className="space-y-5 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-15)] flex items-center justify-center text-[var(--accent)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text)] tracking-tight">Asset Spoofer</h2>
              <p className="text-xs text-[var(--text-45)]">
                Ubah ID Animation, Sound, Decal &amp; lainnya menjadi milik Anda — dukungan batch
              </p>
            </div>
          </div>
        </div>

        {/* Input + Add Button */}
        <div className="flex gap-2">
          <input
            type="text"
            value={assetInput}
            onChange={(e) => setAssetInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Masukkan Asset ID Roblox lalu Enter... (Contoh: 86280001082394)"
            className={INPUT}
            disabled={polling || uploading}
          />
          <button
            onClick={addToQueue}
            disabled={polling || uploading || !assetInput.trim()}
            className={`${BTN_GHOST} shrink-0 px-3`}
            title="Tambah Asset ID"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Queue List */}
        {queue.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--text-60)] font-medium">
                Antrian Asset ({queue.length})
              </p>
              <button onClick={clearQueue} disabled={polling || uploading} className="text-[11px] text-[var(--text-40)] hover:text-rose-300 transition">
                Hapus semua
              </button>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              <AnimatePresence>
                {queue.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, height: 0, y: 6 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -6 }}
                    transition={{ duration: 0.18, delay: index * 0.04 }}
                    className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 transition hover:border-[var(--accent-25)]"
                  >
                    <Film className="w-4 h-4 shrink-0 text-[var(--accent-soft)]" />
                    <code className="min-w-0 flex-1 text-sm font-mono text-[var(--text-80)]">{item.originalAssetId}</code>
                    <button
                      onClick={() => removeFromQueue(item.id)}
                      disabled={polling || uploading}
                      className="p-1.5 text-[var(--text-40)] transition hover:text-rose-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        <button
          onClick={handleStartJob}
          disabled={polling || uploading || queue.length === 0}
          className={`${BTN_PRIMARY} w-full py-3 text-xs font-bold flex items-center justify-center gap-2`}
        >
          {polling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses ({queue.length}) Asset...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Spoof {queue.length > 0 ? `(${queue.length})` : 'Asset'}
            </>
          )}
        </button>

        <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
          <div className="text-xs text-[var(--text-45)]">
            Target Akun:{' '}
            <span className="font-semibold text-[var(--accent-strong)]">
              {selectedAccount ? selectedAccount.name : 'Belum dipilih'}
            </span>
          </div>
          {doneCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--emerald)] font-semibold">
              <Check className="w-3.5 h-3.5" /> {doneCount} sukses
            </span>
          )}
        </div>
      </Card>

      {/* Job Progress / Terminal & Results Modal */}
      <Modal
        isOpen={jobOpen && !!job}
        onClose={() => !uploading && handleCloseModal()}
        preventClose={uploading}
        title={uploading ? 'Uploading ke Roblox' : polling ? 'Memproses Spoof' : 'Hasil Spoof'}
        subtitle={job ? `Job ${job.jobId || 'Active'} · ${job.items.length} asset` : undefined}
        icon={
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-15)] text-[var(--accent)]">
            {uploading || polling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload className="h-4 w-4" />
            )}
          </div>
        }
        size="lg"
        footer={
          <div className="flex gap-3">
            {uploading ? (
              <button
                disabled
                className={`${BTN_PRIMARY} flex-1 py-3 text-xs font-bold disabled:opacity-60 flex items-center justify-center gap-2`}
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Memproses &amp; Mengunggah Asset ke Roblox...
              </button>
            ) : (
              <button onClick={handleCloseModal} className={`${BTN_PRIMARY} w-full py-3 text-xs font-bold`}>
                Tutup Modal
              </button>
            )}
          </div>
        }
      >
        {job && (
          <div className="space-y-4">
            {/* Terminal — hanya saat running */}
            {polling && (
              <Terminal title="spoofer-job.sh" maxHeight="56">
                {(job.logs || []).slice(-40).map((line, i) => (
                  <p key={i} className={line.includes('GAGAL') || line.includes('gagal') ? 'text-rose-300' : 'text-[var(--text-80)]'}>
                    {line}
                  </p>
                ))}
                {job.logs.length === 0 && <p className="text-[var(--text-40)]">Menyiapkan...</p>}
                <span className="inline-block h-3.5 w-2 animate-pulse bg-[var(--accent)] align-middle" />
              </Terminal>
            )}

            {/* Results list */}
            <div className="space-y-2">
              {(job.items || []).map((item) => (
                <div
                  key={item.key}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-xs ${
                    item.status === 'failed'
                      ? 'border-rose-400/25 bg-rose-400/[0.04]'
                      : item.newAssetId
                        ? 'border-[var(--emerald-25)] bg-[var(--emerald-10)]'
                        : 'border-[var(--line)] bg-[var(--surface-50)]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-[var(--text-90)]">
                        {item.name || `Asset_${item.originalAssetId}`}
                      </p>
                      <span className="shrink-0 rounded-md bg-[var(--accent-15)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent-strong)]">
                        {item.assetType || 'Audio'}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-[var(--text-45)] font-mono">
                      ID Asli: {item.originalAssetId}
                    </p>
                    {item.fileName && (
                      <p className="truncate text-[10px] text-[var(--text-35)] font-mono">{item.fileName}</p>
                    )}
                    {item.newAssetId && (
                      <p className="truncate text-[11px] font-mono mt-0.5">
                        ID Baru: <code className="font-bold text-[var(--emerald)]">{item.newAssetId}</code>
                      </p>
                    )}
                    {item.status === 'failed' && (
                      <p className="text-[11px] text-rose-300">{item.error}</p>
                    )}
                    {item.uploadStatus === 'failed' && (
                      <p className="text-[11px] text-rose-300">{item.uploadError}</p>
                    )}
                    {item.uploadStatus === 'done' && item.newAssetId && (
                      <button
                        onClick={() => copyToClipboard(item.newAssetId!, 'ID Baru')}
                        className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)] hover:underline"
                      >
                        <Copy className="w-3 h-3" />
                        Salin ID Baru
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.assetType === 'Audio' && (
                      <button
                        type="button"
                        onClick={() => togglePlayAudio(item.originalAssetId)}
                        className="p-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--accent-soft)] hover:text-[var(--accent-strong)] hover:border-[var(--accent-30)] transition"
                        title={playingAssetId === item.originalAssetId ? "Stop Audio" : "Putar Audio"}
                      >
                        {playingAssetId === item.originalAssetId ? (
                          <Pause className="w-3.5 h-3.5 text-[var(--accent)]" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDownloadAsset(item.originalAssetId)}
                      className="p-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text-60)] hover:text-[var(--text)] hover:border-[var(--accent-30)] transition"
                      title="Download File Asli ke PC"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {(!job.items || job.items.length === 0) && (
                <p className="text-[var(--text-40)] text-xs">Tidak ada item.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* History of Spoofed Assets */}
      {records.length > 0 && (
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
              <History className="w-4 h-4 text-[var(--accent-soft)]" />
              Riwayat Spoofing ({records.length})
            </h3>
            <div className="flex items-center gap-2">
              {doneCount > 0 && (
                <button
                  onClick={() => records.filter((r) => r.status === 'Active').forEach((r) => copyToClipboard(r.newAssetId!, 'Asset ID'))}
                  className="text-[11px] text-[var(--accent-soft)] hover:text-[var(--accent-strong)] transition"
                >
                  Copy semua ID ({doneCount})
                </button>
              )}
              <button
                onClick={clearHistory}
                className="text-[11px] text-[var(--text-40)] hover:text-rose-300 transition"
              >
                Hapus
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {records.map((rec, index) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] p-3.5 text-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text)] truncate">{rec.title}</span>
                      <span className="px-2 py-0.5 rounded-md bg-[var(--accent-15)] text-[var(--accent-strong)] text-[10px] font-semibold uppercase shrink-0">
                        {rec.assetType}
                      </span>
                      <StatusBadge status={rec.status} />
                    </div>
                    <div className="text-[11px] text-[var(--text-45)] font-mono flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span>ID Asli:</span>
                      <code className="text-[var(--text-70)] bg-[var(--surface-strong)] px-1.5 py-0.5 rounded">{rec.originalAssetId}</code>
                      {rec.newAssetId && (
                        <>
                          <span className="text-[var(--accent-soft)]">→</span>
                          <span>ID Baru:</span>
                          <code className="font-bold text-[var(--emerald)] bg-[var(--surface-strong)] px-1.5 py-0.5 rounded">{rec.newAssetId}</code>
                        </>
                      )}
                    </div>
                    {rec.status === 'Failed' && rec.error && (
                      <p className="text-[11px] text-rose-300">{rec.error}</p>
                    )}
                    {rec.status === 'Pending' && (
                      <p className="text-[11px] text-[var(--text-40)]">Status moderasi Roblox masih berlangsung.</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {rec.assetType === 'Audio' && (
                      <button
                        type="button"
                        onClick={() => togglePlayAudio(rec.originalAssetId)}
                        className="p-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--accent-soft)] hover:text-[var(--accent-strong)] hover:border-[var(--accent-30)] transition"
                        title={playingAssetId === rec.originalAssetId ? "Stop Audio" : "Putar Audio"}
                      >
                        {playingAssetId === rec.originalAssetId ? (
                          <Pause className="w-3.5 h-3.5 text-[var(--accent)]" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDownloadAsset(rec.originalAssetId)}
                      className="p-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--text-60)] hover:text-[var(--text)] hover:border-[var(--accent-30)] transition"
                      title="Download File Asli ke PC"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {rec.newAssetId && (
                      <button
                        onClick={() => copyToClipboard(rec.newAssetId!, 'Asset ID Baru')}
                        className={`${BTN_GHOST} text-[11px] px-2.5 py-2 flex items-center gap-1.5 border border-[var(--line)] rounded-xl hover:border-[var(--accent-30)] transition`}
                      >
                        <Copy className="w-3.5 h-3.5 text-[var(--accent-soft)]" />
                        Copy ID
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
