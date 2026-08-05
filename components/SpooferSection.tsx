'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Film, Loader2, Music, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
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

interface SpooferSectionProps {
  selectedAccount: SavedAccount | null;
  backendUrl: string;
}

export default function SpooferSection({ selectedAccount, backendUrl }: SpooferSectionProps) {
  const { toast } = useToast();
  const [assetIdInput, setAssetIdInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [assetType, setAssetType] = useState<'Animation' | 'Audio'>('Animation');
  const [loading, setLoading] = useState(false);
  const [spoofedRecords, setSpoofedRecords] = useState<SpoofedRecord[]>([]);

  const handleSpoof = async () => {
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
    toast(`Memulai spoofing ${assetType} ID: ${cleanId}...`, 'info');

    try {
      const response = await fetch(`${backendUrl}/api/spoof-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: cleanId,
          assetType,
          displayName: displayNameInput.trim() || undefined,
          creatorType: selectedAccount.type,
          creatorId: selectedAccount.id,
          apiKey: selectedAccount.apiKey,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Gagal me-spoof asset Roblox');
      }

      // Poll operation status
      let newAssetId: string | null = null;
      if (data.operationId) {
        for (let attempt = 0; attempt < 60; attempt++) {
          await new Promise((r) => setTimeout(r, 1500));
          const opRes = await fetch(
            `${backendUrl}/api/operation-status/${data.operationId}?apiKey=${encodeURIComponent(selectedAccount.apiKey)}`
          );
          const opData = await opRes.json();
          if (opData.done) {
            if (opData.assetId) {
              newAssetId = opData.assetId;
            } else if (opData.response && opData.response.assetId) {
              newAssetId = opData.response.assetId;
            }
            break;
          }
        }
      }

      if (newAssetId) {
        const newRecord: SpoofedRecord = {
          id: `spoof_${Date.now()}`,
          originalAssetId: cleanId,
          newAssetId,
          assetType,
          title: data.title || `Spoofed_${assetType}_${cleanId}`,
          createdAt: Date.now(),
        };

        setSpoofedRecords((prev) => [newRecord, ...prev]);
        toast(`✨ Berhasil me-spoof ${assetType}! ID Baru: ${newAssetId}`, 'success');
        setAssetIdInput('');
        setDisplayNameInput('');
      } else {
        toast('Spoofing dikirim, namun status moderasi masih berlangsung', 'info');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal me-spoof asset';
      toast(msg, 'error');
    } finally {
      setLoading(false);
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
              <h2 className="text-base font-bold text-[var(--text)] tracking-tight">Animation & Sound Spoofer</h2>
              <p className="text-xs text-[var(--text-45)]">Ubah ID Animasi/Sound Roblox publik menjadi ID Baru milik Anda sendiri</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-[var(--surface-50)] rounded-xl border border-[var(--line)]">
            <button
              onClick={() => setAssetType('Animation')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                assetType === 'Animation' ? 'bg-[var(--accent)] text-[#000000]' : 'text-[var(--text-60)] hover:text-[var(--text)]'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Animation
            </button>
            <button
              onClick={() => setAssetType('Audio')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                assetType === 'Audio' ? 'bg-[var(--accent)] text-[#000000]' : 'text-[var(--text-60)] hover:text-[var(--text)]'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              Sound / Audio
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-[var(--text-60)] mb-1.5">
              Roblox {assetType} Asset ID <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              value={assetIdInput}
              onChange={(e) => setAssetIdInput(e.target.value)}
              placeholder="Contoh: 123456789 atau link catalog"
              className={INPUT}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-60)] mb-1.5">
              Judul Baru (Opsional)
            </label>
            <input
              type="text"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder={`Judul ${assetType} baru...`}
              className={INPUT}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
          <div className="text-xs text-[var(--text-45)]">
            Target Akun: <span className="font-semibold text-[var(--accent-strong)]">{selectedAccount ? selectedAccount.name : 'Belum dipilih'}</span>
          </div>

          <button
            onClick={handleSpoof}
            disabled={loading}
            className={`${BTN_PRIMARY} px-6 py-2.5 text-xs font-bold flex items-center gap-2`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memproses Spoofing...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Spoof & Re-Upload Asset
              </>
            )}
          </button>
        </div>
      </div>

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
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text)]">{rec.title}</span>
                    <span className="px-2 py-0.5 rounded-md bg-[var(--accent-15)] text-[var(--accent-strong)] text-[10px] font-semibold uppercase">
                      {rec.assetType}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--text-45)]">
                    ID Asli: <code className="text-[var(--text-60)]">{rec.originalAssetId}</code> ➔ ID Baru milik Anda: <code className="font-bold text-[var(--emerald)]">{rec.newAssetId}</code>
                  </div>
                </div>

                <div className="flex items-center gap-2">
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
