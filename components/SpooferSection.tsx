'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Film, History, Loader2, Plus, RefreshCw, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import { SavedAccount, SpoofRecord } from '../types/audio';
import { StatusBadge } from './StatusBadge';
import { CARD, INPUT, BTN_PRIMARY, BTN_GHOST } from '../lib/ui';
import { useToast } from './Toast';
import { useSpoofHistory } from '../hooks/useSpoofHistory';

interface QueueItem {
  id: string;
  originalAssetId: string;
}

interface VerifiedAsset extends QueueItem {
  name: string;
  assetType: string;
  status: 'ok' | 'error';
  error?: string;
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
  const { records, setRecords, upsertRecord, updateRecordStatus, clearHistory } = useSpoofHistory();
  const [assetInput, setAssetInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [verifyList, setVerifyList] = useState<VerifiedAsset[]>([]);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  const handleVerify = async () => {
    if (queue.length === 0) {
      toast('Tambahkan Asset ID terlebih dahulu', 'error');
      return;
    }
    if (!selectedAccount || !selectedAccount.apiKey) {
      toast('Pilih Akun Roblox terlebih dahulu di bagian Header', 'error');
      return;
    }

    setDetecting(true);
    setVerifyList([]);
    toast(`Memeriksa ${queue.length} asset...`, 'info');

    const verified: VerifiedAsset[] = [];
    const CONCURRENCY = 3;
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < queue.length) {
        const item = queue[nextIndex++];
        try {
          const response = await fetch(`${backendUrl}/api/spoof-detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assetId: item.originalAssetId }),
          });
          const data = await parseJsonResponse(response);
          if (!response.ok || !data?.success) {
            throw new Error(str(data?.error) || 'Gagal memeriksa asset');
          }
          const type = String((data.assetType as string) || 'Audio');
          verified.push({
            id: item.id,
            originalAssetId: item.originalAssetId,
            name: str(data.name) || `Asset_${item.originalAssetId}`,
            assetType: type,
            status: 'ok',
          });
        } catch (error) {
          verified.push({
            id: item.id,
            originalAssetId: item.originalAssetId,
            name: `Asset_${item.originalAssetId}`,
            assetType: 'Audio',
            status: 'error',
            error: error instanceof Error ? error.message : 'Gagal memeriksa',
          });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setVerifyList(verified);
    setVerifyOpen(true);
    setDetecting(false);

    const okCount = verified.filter((v) => v.status === 'ok').length;
    if (okCount === verified.length) {
      toast(`Semua ${verified.length} asset berhasil diverifikasi`, 'success');
    }
  };

  const handleBatchUpload = async () => {
    if (!selectedAccount || !selectedAccount.apiKey) return;

    const targets = verifyList.filter((v) => v.status === 'ok');
    if (targets.length === 0) {
      toast('Tidak ada asset yang valid untuk di-upload', 'error');
      return;
    }

    setUploading(true);
    toast(`Memulai spoof batch ${targets.length} asset...`, 'info');

    // Tambahkan semua record Pending terlebih dahulu dengan key unik (per item antrian)
    const recordIds = targets.map((t) => `spoof_${Date.now()}_${t.id}`);
    const pendingRecords: SpoofRecord[] = targets.map((t, idx) => ({
      id: recordIds[idx],
      originalAssetId: t.originalAssetId,
      assetType: t.assetType,
      title: displayNameInput.trim() || t.name,
      status: 'Pending',
      createdAt: Date.now(),
    }));
    setRecords((prev) => [...pendingRecords, ...prev]);

    try {
      const response = await fetch(`${backendUrl}/api/spoof-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assets: targets.map((t, idx) => ({
            key: recordIds[idx],
            assetId: t.originalAssetId,
            assetType: t.assetType,
            displayName: displayNameInput.trim() || t.name,
          })),
          creatorType: selectedAccount.type,
          creatorId: selectedAccount.id,
          apiKey: selectedAccount.apiKey,
          cookie: selectedAccount.cookie || undefined,
        }),
      });

      const data = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(str(data?.error) || 'Gagal memproses batch');
      }

      const results = (data.results as JsonRecord[]) || [];
      const resultByKey: Record<string, JsonRecord> = {};
      for (const r of results) {
        resultByKey[str(r.key)] = r;
      }

      // Update setiap record berdasarkan key unik
      for (const recId of recordIds) {
        const res = resultByKey[recId];
        if (!res) continue;
        if (res.success && res.newAssetId) {
          updateRecordStatus(recId, { newAssetId: str(res.newAssetId), status: 'Active' });
        } else {
          updateRecordStatus(recId, {
            status: 'Failed',
            error: str(res.error) || 'Gagal generate ID',
          });
        }
      }
      // Persist semua record ke Supabase sekaligus
      const current = [...pendingRecords];
      setRecords((prev) => {
        for (const recId of recordIds) {
          const res = resultByKey[recId];
          const existing = prev.find((p) => p.id === recId);
          if (existing && res) {
            existing.newAssetId = res.success && res.newAssetId ? str(res.newAssetId) : undefined;
            existing.status = res.success && res.newAssetId ? 'Active' : 'Failed';
            existing.error = res.success ? undefined : str(res.error) || 'Gagal generate ID';
          }
        }
        return prev;
      });
      for (const recId of recordIds) {
        const res = resultByKey[recId];
        if (res) {
          const found = current.find((c) => c.id === recId);
          if (found) {
            await upsertRecord({
              ...found,
              newAssetId: res.success && res.newAssetId ? str(res.newAssetId) : undefined,
              status: res.success && res.newAssetId ? 'Active' : 'Failed',
              error: res.success ? undefined : str(res.error) || 'Gagal generate ID',
            });
          }
        }
      }

      const successCount = Object.values(resultByKey).filter((r) => r.success && r.newAssetId).length;
      toast(`Selesai memproses batch. ${successCount} sukses.`, successCount > 0 ? 'success' : 'error');
      setQueue([]);
      setVerifyOpen(false);
      setVerifyList([]);
      setDisplayNameInput('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal memproses batch';
      setRecords((prev) =>
        prev.map((r) =>
          recordIds.includes(r.id) && r.status === 'Pending' ? { ...r, status: 'Failed', error: msg } : r
        )
      );
      toast(msg, 'error');
      setVerifyOpen(false);
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast(`Berhasil menyalin ${label}!`, 'success');
  };

  const generateLuauScript = (record: SpoofRecord) => {
    if (record.assetType === 'Animation') {
      return `local animation = Instance.new("Animation")\nanimation.Name = "${record.title}"\nanimation.AnimationId = "rbxassetid://${record.newAssetId}"\nlocal track = workspace.CurrentCamera:FindFirstChildOfClass("Humanoid"):LoadAnimation(animation)\ntrack:Play()`;
    }
    return `local sound = Instance.new("Sound")\nsound.Name = "${record.title}"\nsound.SoundId = "rbxassetid://${record.newAssetId}"\nsound.Parent = workspace\nsound:Play()`;
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
                Ubah ID Animation & Sound publik menjadi ID Baru milik Anda sendiri — dukungan batch
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
            placeholder="Masukkan Asset ID Roblox lalu Enter… (Contoh: 86280001082394)"
            className={INPUT}
            disabled={uploading}
          />
          <button
            onClick={addToQueue}
            disabled={uploading || !assetInput.trim()}
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
              <button onClick={clearQueue} disabled={uploading} className="text-[11px] text-[var(--text-40)] hover:text-rose-300 transition">
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
                    disabled={uploading}
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
          onClick={handleVerify}
          disabled={detecting || uploading || queue.length === 0 || !selectedAccount?.apiKey}
          className={`${BTN_PRIMARY} w-full py-3 text-xs font-bold flex items-center justify-center gap-2`}
        >
          {detecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memeriksa ({queue.length}) Asset...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Periksa {queue.length > 0 ? `& Verifikasi (${queue.length})` : 'Asset'}
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

      {/* Verify & Upload Modal */}
      <AnimatePresence>
        {verifyOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => !uploading && !detecting && setVerifyOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl border border-[var(--accent-15)] bg-[var(--panel)] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-[var(--line)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--accent-15)] flex items-center justify-center text-[var(--accent)]">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-[var(--text)]">Verifikasi & Upload</h3>
                    <p className="text-[11px] text-[var(--text-40)]">
                      {verifyList.length} asset siap di-spoof ke {selectedAccount?.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !uploading && !detecting && setVerifyOpen(false)}
                  className="p-1.5 text-[var(--text-40)] transition hover:text-[var(--text)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[55vh] overflow-y-auto">
                {/* Optional Display Name */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-60)] mb-1.5">
                    Judul Baru (Opsional, berlaku untuk semua)
                  </label>
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="Kosongkan untuk menggunakan nama asli"
                    className={INPUT}
                  />
                </div>

                {/* Verified List */}
                <div className="space-y-2">
                  {verifyList.map((v) => (
                    <div
                      key={v.id}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-xs ${
                        v.status === 'error'
                          ? 'border-rose-400/25 bg-rose-400/[0.04]'
                          : 'border-[var(--line)] bg-[var(--surface-50)]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[var(--text-90)]">{v.name}</p>
                        <p className="truncate text-[11px] text-[var(--text-45)] font-mono">ID: {v.originalAssetId}</p>
                      </div>
                      {v.status === 'error' ? (
                        <span className="shrink-0 text-[11px] text-rose-300">{v.error}</span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--accent-15)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent-strong)]">
                          {v.assetType === 'Animation' ? <Film className="w-3 h-3" /> : null}
                          {v.assetType}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 p-5 border-t border-[var(--line)]">
                <button
                  onClick={() => setVerifyOpen(false)}
                  disabled={uploading || detecting}
                  className={`${BTN_GHOST} flex-1 py-3 text-xs font-bold`}
                >
                  Batal
                </button>
                <button
                  onClick={handleBatchUpload}
                  disabled={uploading || detecting || verifyList.every((v) => v.status === 'error')}
                  className={`${BTN_PRIMARY} flex-1 py-3 text-xs font-bold`}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mengupload batch...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Upload {verifyList.filter((v) => v.status === 'ok').length} Asset
                    </>
                  )}
                </button>
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
                    <div className="text-[11px] text-[var(--text-45)]">
                      ID Asli: <code className="text-[var(--text-60)]">{rec.originalAssetId}</code>
                      {rec.newAssetId && (
                        <>
                          {' → '}ID Baru: <code className="font-bold text-[var(--emerald)]">{rec.newAssetId}</code>
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
                      <>
                        <button
                          onClick={() => copyToClipboard(rec.newAssetId!, 'Asset ID Baru')}
                          className={`${BTN_GHOST} text-[11px] px-2.5 py-1 flex items-center gap-1.5`}
                        >
                          <Copy className="w-3 h-3" />
                          Copy ID
                        </button>
                        <button
                          onClick={() => copyToClipboard(generateLuauScript(rec), 'Kode Script Luau')}
                          className={`${BTN_PRIMARY} text-[11px] px-2.5 py-1 flex items-center gap-1.5`}
                        >
                          <Sparkles className="w-3 h-3" />
                          Copy Script
                        </button>
                      </>
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
