'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Film, Loader2, Music, RefreshCw, Sparkles, Wand2, X } from 'lucide-react';
import { SavedAccount } from '../types/audio';
import { CARD, INPUT, BTN_PRIMARY, BTN_GHOST } from '../lib/ui';
import { useToast } from './Toast';

interface SpoofedRecord {
  id: string;
  originalAssetId: string;
  newAssetId: string;
  assetType: 'Animation' | 'Audio';
  title: string;
  createdAt: number;
}

interface DetectedAsset {
  assetId: string;
  name: string;
  assetType: 'Animation' | 'Audio';
}

interface SpooferSectionProps {
  selectedAccount: SavedAccount | null;
  backendUrl: string;
}

type JsonRecord = Record<string, unknown>;

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
  const [assetIdInput, setAssetIdInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [detected, setDetected] = useState<DetectedAsset | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [spoofedRecords, setSpoofedRecords] = useState<SpoofedRecord[]>([]);

  const handleDetect = async () => {
    if (!assetIdInput.trim()) {
      toast('Masukkan Roblox Asset ID terlebih dahulu', 'error');
      return;
    }
    if (!selectedAccount || !selectedAccount.apiKey) {
      toast('Pilih Akun Roblox terlebih dahulu di bagian Header', 'error');
      return;
    }

    const cleanId = assetIdInput.replace(/\D/g, '');
    if (!cleanId) {
      toast('Asset ID Roblox tidak valid', 'error');
      return;
    }

    setLoading(true);
    toast(`Memeriksa Asset ID: ${cleanId}...`, 'info');

    try {
      const response = await fetch(`${backendUrl}/api/spoof-detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: cleanId }),
      });

      const data = await parseJsonResponse(response);
      if (!response.ok || !data?.success) {
        throw new Error(str(data?.error) || 'Gagal memeriksa asset Roblox');
      }

      const detectedAsset: DetectedAsset = {
        assetId: cleanId,
        name: str(data.name) || `Asset_${cleanId}`,
        assetType: (data.assetType as string) === 'Audio' ? 'Audio' : 'Animation',
      };
      setDetected(detectedAsset);
      setVerifyOpen(true);
      toast(`Asset ditemukan: ${detectedAsset.name} (${detectedAsset.assetType})`, 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal memeriksa asset';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!detected || !selectedAccount || !selectedAccount.apiKey) return;

    setUploading(true);
    toast(`Membuat ${detected.assetType} baru untuk "${detected.name}"...`, 'info');

    try {
      const response = await fetch(`${backendUrl}/api/spoof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: detected.assetId,
          assetType: detected.assetType,
          displayName: displayNameInput.trim() || detected.name,
          creatorType: selectedAccount.type,
          creatorId: selectedAccount.id,
          apiKey: selectedAccount.apiKey,
        }),
      });

      const data = await parseJsonResponse(response);
      if (!response.ok || !data?.success) {
        throw new Error(str(data?.error) || 'Gagal membuat asset Roblox');
      }

      // Poll operation status
      let newAssetId: string | null = null;
      if (data.operationId) {
        const operationId = str(data.operationId);
        for (let attempt = 0; attempt < 60; attempt++) {
          await new Promise((r) => setTimeout(r, 1500));
          const opRes = await fetch(
            `${backendUrl}/api/operation-status/${operationId}?apiKey=${encodeURIComponent(selectedAccount.apiKey)}`
          );
          const opText = await opRes.text();
          if (!opText.trim().startsWith('{')) break;
          const opData = JSON.parse(opText) as JsonRecord;
          if (opData.done) {
            if (opData.assetId) {
              newAssetId = str(opData.assetId);
            } else if (opData.response && (opData.response as JsonRecord).assetId) {
              newAssetId = str((opData.response as JsonRecord).assetId);
            }
            break;
          }
        }
      } else if (data.newAssetId) {
        newAssetId = String(data.newAssetId);
      }

      if (newAssetId) {
        const newRecord: SpoofedRecord = {
          id: `spoof_${Date.now()}`,
          originalAssetId: detected.assetId,
          newAssetId,
          assetType: detected.assetType,
          title: displayNameInput.trim() || detected.name,
          createdAt: Date.now(),
        };

        setSpoofedRecords((prev) => [newRecord, ...prev]);
        toast(`✨ Berhasil membuat ${detected.assetType}! ID Baru: ${newAssetId}`, 'success');
        setAssetIdInput('');
        setDisplayNameInput('');
        setDetected(null);
        setVerifyOpen(false);
      } else {
        toast('Asset dibuat, namun status moderasi masih berlangsung', 'info');
        setVerifyOpen(false);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal membuat asset';
      toast(msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast(`Berhasil menyalin ${label}!`, 'success');
  };

  const generateLuauScript = (record: SpoofedRecord) => {
    if (record.assetType === 'Animation') {
      return `local animation = Instance.new("Animation")\nanimation.Name = "${record.title}"\nanimation.AnimationId = "rbxassetid://${record.newAssetId}"\nlocal track = workspace.CurrentCamera:FindFirstChildOfClass("Humanoid"):LoadAnimation(animation)\ntrack:Play()`;
    }
    return `local sound = Instance.new("Sound")\nsound.Name = "${record.title}"\nsound.SoundId = "rbxassetid://${record.newAssetId}"\nsound.Parent = workspace\nsound:Play()`;
  };

  return (
    <div className="space-y-6">
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
                Ubah ID Animation & Sound publik menjadi ID Baru milik Anda sendiri — tipe dideteksi otomatis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-[var(--surface-50)] rounded-xl border border-[var(--line)]">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--accent-strong)]">
              <RefreshCw className="w-3.5 h-3.5" />
              Auto-Detect
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-[var(--text-60)] mb-1.5">
              Roblox Asset ID <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              value={assetIdInput}
              onChange={(e) => setAssetIdInput(e.target.value)}
              placeholder="Contoh: 123456789 atau link catalog"
              className={INPUT}
            />
            <p className="mt-1.5 text-[11px] text-[var(--text-40)]">
              Tipe (Animation / Sound) dideteksi otomatis dari ID.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-60)] mb-1.5">
              Judul Baru (Opsional)
            </label>
            <input
              type="text"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="Judul asset baru..."
              className={INPUT}
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleDetect}
              disabled={loading || !assetIdInput.trim()}
              className={`${BTN_PRIMARY} w-full py-3 text-xs font-bold flex items-center justify-center gap-2`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memeriksa Asset...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Periksa & Verifikasi
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
          <div className="text-xs text-[var(--text-45)]">
            Target Akun:{' '}
            <span className="font-semibold text-[var(--accent-strong)]">
              {selectedAccount ? selectedAccount.name : 'Belum dipilih'}
            </span>
          </div>
        </div>
      </div>

      {/* Verify & Upload Modal */}
      <AnimatePresence>
        {verifyOpen && detected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => !uploading && setVerifyOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[var(--accent-15)] bg-[var(--panel)] shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[var(--accent-15)] flex items-center justify-center text-[var(--accent)]">
                    <Check className="w-4 h-4" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-[var(--text)]">Verifikasi Asset</h3>
                </div>
                <button
                  onClick={() => !uploading && setVerifyOpen(false)}
                  className="p-1.5 text-[var(--text-40)] transition hover:text-[var(--text)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-45)]">Nama Asset</p>
                    <p className="text-sm font-bold text-[var(--text)] truncate">{detected.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-45)]">Tipe Asset</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {detected.assetType === 'Animation' ? (
                        <Film className="w-3.5 h-3.5 text-[var(--accent)]" />
                      ) : (
                        <Music className="w-3.5 h-3.5 text-[var(--accent)]" />
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-[var(--accent-15)] text-[var(--accent-strong)] text-[10px] font-semibold uppercase">
                        {detected.assetType}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-45)]">ID Asli</p>
                    <p className="text-sm font-mono font-semibold text-[var(--text)] mt-0.5">{detected.assetId}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-[var(--line)] text-xs text-[var(--text-45)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--emerald)] shrink-0" />
                  Akan dibuat sebagai asset baru milik{' '}
                  <span className="font-semibold text-[var(--accent-strong)]">{selectedAccount?.name}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setVerifyOpen(false)}
                  disabled={uploading}
                  className={`${BTN_GHOST} flex-1 py-3 text-xs font-bold`}
                >
                  Batal
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className={`${BTN_PRIMARY} flex-1 py-3 text-xs font-bold`}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mengupload...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Upload ke Roblox
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History of Spoofed Assets */}
      {spoofedRecords.length > 0 && (
        <div className={`${CARD} p-5 space-y-4`}>
          <h3 className="text-sm font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
            <Check className="w-4 h-4 text-[var(--emerald)]" />
            Riwayat Asset Hasil Spoofing ({spoofedRecords.length})
          </h3>

          <div className="space-y-3">
            {spoofedRecords.map((rec) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] text-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text)] truncate">{rec.title}</span>
                    <span className="px-2 py-0.5 rounded-md bg-[var(--accent-15)] text-[var(--accent-strong)] text-[10px] font-semibold uppercase shrink-0">
                      {rec.assetType}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--text-45)]">
                    ID Asli: <code className="text-[var(--text-60)]">{rec.originalAssetId}</code> ➔ ID Baru:{' '}
                    <code className="font-bold text-[var(--emerald)]">{rec.newAssetId}</code>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copyToClipboard(rec.newAssetId, 'Asset ID Baru')}
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
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
