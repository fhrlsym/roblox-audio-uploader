import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CloudUpload, Copy, Download, Loader2, Music, RotateCcw, Trash2 } from 'lucide-react';
import { TunedAudioFile, UploadResult, SavedAccount, UploadRecord } from '../types/audio';
import { StatusBadge } from './StatusBadge';
import { useToast } from './Toast';
import { BTN_PRIMARY, cleanSongTitle } from '../lib/ui';
import { Card } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import { ProgressBar } from './ui/ProgressBar';

interface OutputSectionProps {
  tunedFiles: TunedAudioFile[];
  onRemoveTuned: (id: string) => void;
  backendUrl: string;
  selectedAccount: SavedAccount | null;
  onUploadSuccess?: (record: UploadRecord) => void;
}

export default function OutputSection({ tunedFiles, onRemoveTuned, backendUrl, selectedAccount, onUploadSuccess }: OutputSectionProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadResults, setUploadResults] = useState<Record<string, UploadResult>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const handleDownload = (file: TunedAudioFile) => {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.tunedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyAssetId = (assetId: string) => {
    navigator.clipboard.writeText(assetId);
    toast('Asset ID disalin', 'success');
  };

  const copySongInfo = (name: string, assetId: string, playbackSpeed: string) => {
    navigator.clipboard.writeText(`${name}\n${assetId}\n${playbackSpeed}`);
    toast('Nama lagu, asset ID & playback speed disalin', 'success');
  };

  const handleUploadToRoblox = async (file: TunedAudioFile): Promise<boolean> => {
    if (!selectedAccount || !selectedAccount.apiKey) {
      toast('Pilih akun Roblox terlebih dahulu di bagian Roblox Account', 'error');
      return false;
    }

    setUploading((prev) => ({ ...prev, [file.id]: true }));
    setUploadProgress((prev) => ({ ...prev, [file.id]: 5 }));

    try {
      const displayName = cleanSongTitle(file.tunedName);
      const formData = new FormData();
      formData.append('file', file.blob, file.tunedName);
      formData.append('displayName', displayName);
      formData.append('description', `Speed: ${file.speed}x | Amplify: ${file.amplify}dB | Roblox Playback: ${(1 / file.speed).toFixed(4)}`);
      formData.append('creatorType', selectedAccount.type);
      formData.append('creatorId', selectedAccount.id);
      formData.append('apiKey', selectedAccount.apiKey);

      const response = await fetch(`${backendUrl}/api/upload-to-roblox`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.operationId) {
        throw new Error(data.error || 'Upload failed');
      }

      const operationId = data.operationId;
      let assetId: string | null = null;
      let status = 'Pending';
      let opError: string | null = null;

      // Poll status every 1000ms directly via backend
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((r) => setTimeout(r, 1000));
        setUploadProgress((prev) => ({ ...prev, [file.id]: Math.min(90, 8 + (attempt / 60) * 82) }));

        const opResponse = await fetch(
          `${backendUrl}/api/operation-status/${operationId}?apiKey=${encodeURIComponent(selectedAccount.apiKey)}`
        );
        const opData = await opResponse.json().catch(() => null);

        if (opData && opData.done) {
          if (opData.response && opData.response.assetId) {
            assetId = opData.response.assetId;
            status = 'Active';
          } else if (opData.assetId) {
            assetId = opData.assetId;
            status = opData.status || 'Pending';
          } else if (opData.error) {
            opError = typeof opData.error === 'string' ? opData.error : opData.error.message || 'Upload failed during moderation';
          }
          break;
        }
      }

      if (assetId) {
        setUploadProgress((prev) => ({ ...prev, [file.id]: 100 }));
        setUploadResults((prev) => ({
          ...prev,
          [file.id]: { filename: file.tunedName, assetId, status, success: true },
        }));

        if (onUploadSuccess) {
          onUploadSuccess({
            id: `${Date.now()}-${file.id}`,
            fileName: displayName,
            displayName,
            assetId,
            accountName: selectedAccount.name,
            uploadedAt: Date.now(),
            fileSize: file.blob.size,
            robloxPlaybackSpeed: (1 / file.speed).toFixed(4),
            originalSpeed: file.speed,
            amplify: file.amplify,
            status,
          });
        }
        toast(`Berhasil mengunggah "${displayName}" ke Roblox!`, 'success');
        return true;
      } else {
        setUploadResults((prev) => ({
          ...prev,
          [file.id]: { filename: file.tunedName, error: opError || 'Upload timeout', success: false },
        }));
        toast(`Gagal upload ${displayName}: ${opError || 'Upload timeout'}`, 'error');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setUploadResults((prev) => ({
        ...prev,
        [file.id]: { filename: file.tunedName, error: message, success: false },
      }));
      toast(`Gagal upload: ${message}`, 'error');
    } finally {
      setUploading((prev) => ({ ...prev, [file.id]: false }));
    }
    return false;
  };

  const handleUploadAll = async () => {
    if (!selectedAccount || !selectedAccount.apiKey) {
      toast('Pilih akun Roblox terlebih dahulu di bagian Roblox Account', 'error');
      return;
    }
    const targets = tunedFiles.filter((f) => !uploadResults[f.id]?.success && !uploading[f.id]);
    if (targets.length === 0) return;

    toast(`Memulai batch upload ${targets.length} audio ke Roblox...`, 'info');

    const CONCURRENCY = 2;
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < targets.length) {
        const file = targets[nextIndex++];
        await handleUploadToRoblox(file);
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
    toast(`Selesai memproses batch upload ${targets.length} audio!`, 'success');
  };

  const pendingCount = tunedFiles.filter((f) => !uploadResults[f.id]?.success).length;
  const uploadingAny = Object.values(uploading).some(Boolean);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold uppercase tracking-wide text-[var(--text)]">3. Output &amp; Upload</h2>
      </div>

      {tunedFiles.length === 0 ? (
        <EmptyState
          icon={<Music className="h-5 w-5" />}
          title="Belum ada file di-tune"
          description="Tuning audio dulu di langkah 2 (Tuning) — file hasil tuning akan muncul di sini untuk di-upload."
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {tunedFiles.map((file, index) => {
              const result = uploadResults[file.id];

              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, height: 0, y: 6 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -6 }}
                  transition={{ duration: 0.2, delay: index * 0.04 }}
                  className={`brutal-card-sm p-4 ${result?.success ? 'bg-[var(--emerald)]/10' : result ? 'bg-[var(--danger)]/10' : ''}`}
                >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--text-90)]">{cleanSongTitle(file.tunedName)}</p>
                    <p className="mt-0.5 text-xs font-medium text-[var(--text-50)]">
                      Speed {file.speed}x · Amplify {file.amplify > 0 ? '+' : ''}{file.amplify}dB · Playback{' '}
                      <span className="font-mono font-bold text-[var(--accent)]">{(1 / file.speed).toFixed(4)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => handleDownload(file)}
                      className="rounded-md border-2 border-[var(--text)] bg-[var(--bg)] p-1.5 text-[var(--text)] transition hover:bg-[var(--accent)] hover:text-[var(--on-accent)] active:translate-y-[1px]"
                      aria-label={`Unduh ${cleanSongTitle(file.tunedName)}`}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRemoveTuned(file.id)}
                      className="rounded-md border-2 border-[var(--text)] bg-[var(--bg)] p-1.5 text-[var(--text)] transition hover:bg-[var(--danger)] hover:text-white active:translate-y-[1px]"
                      aria-label={`Hapus ${cleanSongTitle(file.tunedName)}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {uploading[file.id] && (
                  <div className="mt-3 flex items-center gap-3">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--accent)]" />
                    <ProgressBar value={uploadProgress[file.id] ?? 5} className="flex-1" />
                    <span className="shrink-0 font-mono text-[10px] font-bold text-[var(--text-50)]">
                      {Math.round(uploadProgress[file.id] ?? 5)}%
                    </span>
                  </div>
                )}

                {result && (
                  <div className="mt-3">
                    {result.success ? (
                      <div className="brutal-card-sm p-4 bg-[var(--accent)]/10">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={result.status || 'Pending'} />
                          <div className="ml-auto flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => copySongInfo(file.tunedName, result.assetId!, (1 / file.speed).toFixed(4))}
                              className="inline-flex items-center gap-1.5 rounded-md border-2 border-[var(--text)] bg-[var(--accent)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--on-accent)] shadow-[2px_2px_0_0_var(--text)] transition hover:-translate-y-[1px] hover:shadow-[3px_3px_0_0_var(--text)] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--text)]"
                            >
                              <Copy className="w-3 h-3" />
                              Salin 3 info
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-50)] flex-shrink-0 w-24 pt-0.5">Nama</span>
                            <span className="text-sm font-bold text-[var(--text-90)] text-right">{file.tunedName}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-50)] flex-shrink-0 w-24 pt-0.5">Asset ID</span>
                            <button
                              onClick={() => copyAssetId(result.assetId!)}
                              className="group inline-flex items-center gap-1.5 font-mono text-sm font-bold text-[var(--accent)] transition hover:text-[var(--accent-deep)]"
                            >
                              {result.assetId}
                              <Copy className="w-3 h-3 opacity-50 transition group-hover:opacity-100" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-2 rounded-md border-2 border-[var(--text)] bg-[var(--bg)] px-3 py-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-50)] flex-shrink-0">Playback Speed</span>
                            <span className="font-mono text-lg font-bold text-[var(--accent)]">
                              {(1 / file.speed).toFixed(4)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-[var(--danger)]">{result.error}</p>
                    )}
                  </div>
                )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {tunedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {tunedFiles.some((f) => uploadResults[f.id] && !uploadResults[f.id].success) && (
            <button
              onClick={() => {
                const failedTargets = tunedFiles.filter(
                  (f) => uploadResults[f.id] && !uploadResults[f.id].success && !uploading[f.id]
                );
                failedTargets.forEach((file) => handleUploadToRoblox(file));
              }}
              disabled={uploadingAny}
              className="w-full py-2 text-xs font-bold uppercase tracking-wide rounded-lg border-2 border-[var(--text)] bg-[var(--danger)] text-white shadow-[3px_3px_0_0_var(--text)] transition hover:-translate-y-[1px] hover:shadow-[4px_4px_0_0_var(--text)] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--text)] flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_0_var(--text)]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Coba Ulang File yang Gagal ({tunedFiles.filter((f) => uploadResults[f.id] && !uploadResults[f.id].success).length})
            </button>
          )}

          <button
            onClick={handleUploadAll}
            disabled={uploadingAny || pendingCount === 0}
            className={BTN_PRIMARY + ' w-full py-3'}
          >
            {uploadingAny ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <CloudUpload className="w-4 h-4" />
                Upload Semua ke Roblox ({pendingCount})
              </>
            )}
          </button>
        </div>
      )}

    </Card>
  );
}
