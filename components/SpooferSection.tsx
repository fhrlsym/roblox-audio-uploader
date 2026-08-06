'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CloudUpload, Copy, Film, History, Loader2, Plus, Sparkles, Trash2, UploadCloud, Wand2, X } from 'lucide-react';
import { SavedAccount } from '../types/audio';
import { StatusBadge } from './StatusBadge';
import { CARD, INPUT, BTN_PRIMARY, BTN_GHOST } from '../lib/ui';
import { useToast } from './Toast';
import { useSpoofHistory } from '../hooks/useSpoofHistory';

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
    throw new Error(
      `Backend mengembalikan HTML, bukan JSON (status ${res.status}). ` +
        `Cek apakah backend berjalan dan NEXT_PUBLIC_BACKEND_URL sudah benar.`
    );
  }
}

export default function SpooferSection({ selectedAccount, backendUrl }: SpooferSectionProps) {
  const { toast } = useToast();
  const { records, upsertRecord, clearHistory } = useSpoofHistory();
  const [assetInput, setAssetInput] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);

  // Job state (download terminal + upload)
  const [job, setJob] = useState<SpoofJob | null>(null);
  const [jobOpen, setJobOpen] = useState(false);
  const [polling, setPolling] = useState(false);
const [uploading, setUploading] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore antrian spoof dari localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(QUEUE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as QueueItem[];
        if (Array.isArray(parsed)) setQueue(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist antrian spoof ke localStorage
  useEffect(() => {
    try {
      if (queue.length > 0) {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      } else {
        localStorage.removeItem(QUEUE_KEY);
      }
    } catch {
      // ignore
    }
  }, [queue]);

const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setPolling(false);
  };

  useEffect(() => () => stopPolling(), []);

  const parseAssetId = (input: string): string | null => {
    const clean = String(input).replace(/\D/g, '');
    return clean || null;
  };

  const addToQueue = () => {
    const id = parseAssetId(assetInput);
    if (!id) {
      toast('Masukkan Asset ID Roblox yang valid', 'error');
      return;
    }
    if (queue.some((q) => q.originalAssetId === id)) {
      toast('Asset ID sudah ada di antrian', 'error');
      return;
    }
    setQueue((prev) => [{ id: `q_${Date.now()}_${Math.random().toString(36).slice(2)}`, originalAssetId: id }, ...prev]);
    setAssetInput('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addToQueue();
    }
  };

  const removeFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const clearQueue = () => setQueue([]);

  const handleStartJob = async () => {
    if (queue.length === 0) {
      toast('Tambahkan Asset ID terlebih dahulu', 'error');
      return;
    }
    if (polling || uploading) return;

    const assetIds = queue.map((q) => q.originalAssetId);
    setJob(null);
    setJobOpen(true);
    toast(`Memulai spoof ${assetIds.length} asset...`, 'info');

    try {
      const res = await fetch(`${backendUrl}/api/spoof-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(str(data?.error) || 'Gagal membuat job');
const j = data.job as unknown as SpoofJob;
      setJob(j);
      pollSpoofJobLoop(j.jobId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal membuat job';
      toast(msg, 'error');
      setJobOpen(false);
    }
  };

  const pollSpoofJobLoop = (jobId: string) => {
    stopPolling();
    setPolling(true);
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${backendUrl}/api/spoof-job/${jobId}`, { cache: 'no-store' });
        const data = await parseJsonResponse(res);
        if (!data?.job) {
          stopPolling();
          return;
        }
        const j = data.job as unknown as SpoofJob;
        setJob(j);
        if (j.status === 'completed' || j.status === 'failed' || j.status === 'partially') {
          stopPolling();
        }
      } catch {
        // biarkan polling lanjut
      }
    }, 1300);
  };

  const handleUpload = async () => {
    if (!selectedAccount || !selectedAccount.apiKey) {
      toast('Pilih Akun Roblox terlebih dahulu di bagian Header', 'error');
      return;
    }
    if (!job || uploading) return;

    setUploading(true);
    try {
      const res = await fetch(`${backendUrl}/api/spoof-job/${job.jobId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorType: selectedAccount.type,
          creatorId: selectedAccount.id,
          apiKey: selectedAccount.apiKey,
        }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(str(data?.error) || 'Gagal upload ke Roblox');
      const j = data.job as unknown as SpoofJob;
      setJob(j);

      // Persis ke riwayat (Supabase)
      const doneItems = j.items.filter((it) => it.uploadStatus === 'done' && it.newAssetId);
      for (const it of doneItems) {
        await upsertRecord({
          id: it.key,
          originalAssetId: it.originalAssetId,
          newAssetId: it.newAssetId,
          assetType: it.assetType || 'Audio',
          title: it.name || `Asset_${it.originalAssetId}`,
          status: 'Active',
          createdAt: Date.now(),
        });
      }
      const failItems = j.items.filter((it) => it.uploadStatus === 'failed' || it.status === 'failed');
      for (const it of failItems) {
        await upsertRecord({
          id: it.key,
          originalAssetId: it.originalAssetId,
          assetType: it.assetType || 'Audio',
          title: it.name || `Asset_${it.originalAssetId}`,
          status: 'Failed',
          error: it.uploadError || it.error || 'Gagal',
          createdAt: Date.now(),
        });
      }

      toast(`Upload selesai. ${doneItems.length} sukses.`, doneItems.length > 0 ? 'success' : 'error');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal upload ke Roblox';
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

  const readyItems = (job?.items || []).filter((it) => it.status === 'downloaded' || (it.status !== 'failed' && !it.error));
  const newIdCount = (job?.items || []).filter((it) => it.uploadStatus === 'done').length;

  return (
    <div className="space-y-6">
      {/* Spoofer Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className={`${CARD} p-4 text-center`}>
          <p className="text-[11px] font-medium text-[var(--text-45)] uppercase tracking-wider">Total Spoof</p>
          <p className="text-2xl font-bold text-[var(--text)] mt-1">{stats.total}</p>
        </div>
        <div className={`${CARD} p-4 text-center`}>
          <p className="text-[11px] font-medium text-[var(--text-45)] uppercase tracking-wider">Success</p>
          <p className="text-2xl font-bold text-[var(--emerald)] mt-1">{stats.active}</p>
        </div>
        <div className={`${CARD} p-4 text-center`}>
          <p className="text-[11px] font-medium text-[var(--text-45)] uppercase tracking-wider">Failed</p>
          <p className="text-2xl font-bold text-[var(--danger)] mt-1">{stats.failed}</p>
        </div>
      </div>

      {/* Workbench Form Card */}
      <div className={`${CARD} p-6 space-y-5`}>
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
              {queue.map((item) => (
                <div
                  key={item.id}
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
                </div>
              ))}
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
      </div>

      {/* Job Progress / Terminal & Results Modal */}
      <AnimatePresence>
        {jobOpen && job && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => !polling && !uploading && setJobOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl border border-[var(--accent-15)] bg-[var(--panel)] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-[var(--line)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--accent-15)] flex items-center justify-center text-[var(--accent)]">
                    {uploading || polling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CloudUpload className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-[var(--text)]">
                      {uploading ? 'Uploading ke Roblox' : polling ? 'Memproses Spoof' : 'Hasil Spoof'}
                    </h3>
                    <p className="text-[11px] text-[var(--text-40)] font-mono">
                      Job {job.jobId || 'Active'} · {job.items.length} asset
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !polling && !uploading && setJobOpen(false)}
                  className="p-1.5 text-[var(--text-40)] transition hover:text-[var(--text)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Terminal â€” hanya saat running */}
              {polling && (
                <div className="mx-5 mt-5 rounded-xl bg-black/70 border border-[var(--line)] overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-2 text-[10px] text-white/50 font-mono">spoofer-job.sh</span>
                  </div>
                  <div className="p-3 max-h-56 overflow-y-auto font-mono text-[11px] leading-relaxed">
                    {(job.logs || []).slice(-40).map((line, i) => (
                      <p key={i} className={line.includes('GAGAL') || line.includes('gagal') ? 'text-rose-300' : 'text-[var(--text-80)]'}>
                        {line}
                      </p>
                    ))}
                    {job.logs.length === 0 && (
                      <p className="text-[var(--text-40)]">Menyiapkan...</p>
                    )}
                    <span className="inline-block w-2 h-3.5 bg-[var(--accent)] animate-pulse align-middle" />
                  </div>
                </div>
              )}

              <div className="p-5 space-y-4 max-h-[55vh] overflow-y-auto">
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
                    </div>
                  ))}
                  {(!job.items || job.items.length === 0) && (
                    <p className="text-[var(--text-40)] text-xs">Tidak ada item.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 p-5 border-t border-[var(--line)]">
                {polling ? (
                  <button
                    disabled
                    className={`${BTN_PRIMARY} flex-1 py-3 text-xs font-bold disabled:opacity-60`}
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menunggu proses selesai...
                  </button>
                ) : uploading ? (
                  <button
                    disabled
                    className={`${BTN_PRIMARY} flex-1 py-3 text-xs font-bold disabled:opacity-60`}
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mengupload {readyItems.length} asset ke Roblox...
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setJobOpen(false)}
                      className={`${BTN_GHOST} flex-1 py-3 text-xs font-bold`}
                    >
                      Tutup
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={!selectedAccount?.apiKey || readyItems.length === 0 || newIdCount === readyItems.length}
                      className={`${BTN_PRIMARY} flex-1 py-3 text-xs font-bold`}
                    >
                      <UploadCloud className="w-4 h-4" />
                      Upload {readyItems.length} Asset ke Roblox
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History of Spoofed Assets */}
      {records.length > 0 && (
        <div className={`${CARD} p-5 space-y-4`}>
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
            {records.map((rec) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
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
                    {rec.newAssetId && (
                      <button
                        onClick={() => copyToClipboard(rec.newAssetId!, 'Asset ID Baru')}
                        className={`${BTN_GHOST} text-[11px] px-2.5 py-1.5 flex items-center gap-1.5 border border-[var(--line)] rounded-xl hover:border-[var(--accent-30)] transition`}
                      >
                        <Copy className="w-3 h-3 text-[var(--accent-soft)]" />
                        Copy ID
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
</div>
  );
}
