import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CloudUpload, Copy, Download, Loader2, Music, RotateCcw, Trash2 } from 'lucide-react';
import { TunedAudioFile, UploadResult, SavedAccount, UploadRecord } from '../types/audio';
import { StatusBadge } from './StatusBadge';
import { useToast } from './Toast';
import { CARD, BTN_PRIMARY, cleanSongTitle } from '../lib/ui';
import GitHubExportModal, { ExportableSong, GitHubIcon } from './GitHubExportModal';

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
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [exportSongs, setExportSongs] = useState<ExportableSong[]>([]);
  const [uploadedCompletedList, setUploadedCompletedList] = useState<ExportableSong[]>([]);

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

  const openGitHubSyncForAll = () => {
    const activeFromTuned = tunedFiles
      .filter((f) => uploadResults[f.id]?.success && uploadResults[f.id]?.assetId)
      .map((f) => ({
        assetId: uploadResults[f.id]!.assetId!,
        name: cleanSongTitle(f.tunedName),
        playbackSpeed: (1 / f.speed).toFixed(4),
        originalSpeed: f.speed,
      }));

    const all: ExportableSong[] = [...activeFromTuned];
    for (const song of uploadedCompletedList) {
      if (!all.some((s) => s.assetId === song.assetId)) {
        all.push(song);
      }
    }

    if (all.length === 0) {
      toast('Belum ada lagu yang berhasil di-upload ke Roblox', 'error');
      return;
    }
    setExportSongs(all);
    setShowGitHubModal(true);
  };

  const openGitHubSyncForSingle = (file: TunedAudioFile, assetId: string) => {
    setExportSongs([
      {
        assetId,
        name: cleanSongTitle(file.tunedName),
        playbackSpeed: (1 / file.speed).toFixed(4),
        originalSpeed: file.speed,
      },
    ]);
    setShowGitHubModal(true);
  };

  const handleUploadToRoblox = async (file: TunedAudioFile) => {
    if (!selectedAccount || !selectedAccount.apiKey) {
      toast('Pilih akun Roblox terlebih dahulu di bagian Roblox Account', 'error');
      return;
    }

    setUploading((prev) => ({ ...prev, [file.id]: true }));

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
        setUploadResults((prev) => ({
          ...prev,
          [file.id]: { filename: file.tunedName, assetId, status, success: true },
        }));

        const newExportable: ExportableSong = {
          assetId,
          name: displayName,
          playbackSpeed: (1 / file.speed).toFixed(4),
          originalSpeed: file.speed,
        };
        setUploadedCompletedList((prev) => {
          const exists = prev.some((s) => s.assetId === assetId);
          return exists ? prev : [newExportable, ...prev];
        });

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
        // Auto remove tuned file from queue so step counts stay accurate
        setTimeout(() => {
          onRemoveTuned(file.id);
        }, 1500);
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
  const totalCompletedCount = uploadedCompletedList.length + tunedFiles.filter((f) => uploadResults[f.id]?.success && uploadResults[f.id]?.assetId && !uploadedCompletedList.some(u => u.assetId === uploadResults[f.id]?.assetId)).length;

  return (
    <div className={CARD + ' p-4'}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--text)] tracking-tight">3. Output &amp; Upload</h2>
        {totalCompletedCount > 0 && (
          <button
            type="button"
            onClick={openGitHubSyncForAll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent-deep)] px-3 py-1.5 text-[11px] font-semibold text-[var(--on-accent)] transition hover:brightness-110 active:scale-[0.97]"
          >
            <GitHubIcon className="w-3.5 h-3.5" />
            Sync ke GitHub ({totalCompletedCount})
          </button>
        )}
      </div>

      {tunedFiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] py-6 text-center">
          <Music className="mx-auto mb-2 w-6 h-6 text-[var(--text-30)]" />
          <p className="text-sm text-[var(--text-45)]">Belum ada file yang di-tune.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {tunedFiles.map((file) => {
              const result = uploadResults[file.id];

              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, height: 0, y: 6 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className={`rounded-xl border p-4 transition ${result?.success
                      ? 'border-emerald-400/15 bg-emerald-400/[0.04]'
                      : result
                        ? 'border-rose-400/15 bg-rose-400/[0.04]'
                        : 'border-[var(--line)] bg-[var(--surface)]'
                    }`}
                >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-90)]">{cleanSongTitle(file.tunedName)}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-45)]">
                      Speed {file.speed}x · Amplify {file.amplify > 0 ? '+' : ''}{file.amplify}dB · Playback{' '}
                      <span className="font-mono text-[var(--accent-soft)]">{(1 / file.speed).toFixed(4)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => handleDownload(file)}
                      className="p-1.5 text-[var(--text-40)] transition hover:text-[var(--accent-soft)]"
                      title="Unduh MP3"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRemoveTuned(file.id)}
                      className="p-1.5 text-[var(--text-40)] transition hover:text-rose-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {result && (
                  <div className="mt-3">
                    {result.success ? (
                      <div className="rounded-xl border border-[var(--accent-20)] bg-[var(--accent-06)] p-4">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={result.status || 'Pending'} />
                          <div className="ml-auto flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openGitHubSyncForSingle(file, result.assetId!)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-50)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--accent-strong)] hover:bg-[var(--surface)] transition"
                            >
                              <GitHubIcon className="w-3 h-3" />
                              Sync GitHub
                            </button>
                            <button
                              type="button"
                              onClick={() => copySongInfo(file.tunedName, result.assetId!, (1 / file.speed).toFixed(4))}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent-deep)] px-3 py-1.5 text-[11px] font-semibold text-[var(--on-accent)] transition hover:brightness-110 active:scale-[0.97]"
                            >
                              <Copy className="w-3 h-3" />
                              Salin 3 info
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-40)] flex-shrink-0 w-24 pt-0.5">Nama</span>
                            <span className="text-sm font-medium text-[var(--text-90)] text-right">{file.tunedName}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-40)] flex-shrink-0 w-24 pt-0.5">Asset ID</span>
                            <button
                              onClick={() => copyAssetId(result.assetId!)}
                              className="group inline-flex items-center gap-1.5 font-mono text-sm text-[var(--accent-soft)] transition hover:text-[var(--accent-strong)]"
                            >
                              {result.assetId}
                              <Copy className="w-3 h-3 opacity-50 transition group-hover:opacity-100" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-strong)] px-3 py-2">
                            <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-40)] flex-shrink-0">Playback Speed</span>
                            <span className="font-mono text-lg font-semibold text-[var(--accent-strong)]">
                              {(1 / file.speed).toFixed(4)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-rose-300">{result.error}</p>
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
              className="w-full py-2 text-xs font-semibold rounded-xl border border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20 transition flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Coba Ulang File yang Gagal ({tunedFiles.filter((f) => uploadResults[f.id] && !uploadResults[f.id].success).length})
            </button>
          )}

          {tunedFiles.some((f) => uploadResults[f.id]?.success && uploadResults[f.id]?.assetId) && (
            <button
              type="button"
              onClick={openGitHubSyncForAll}
              className="w-full py-2.5 text-xs font-semibold rounded-xl border border-[var(--accent-30)] bg-[var(--accent-10)] text-[var(--accent-strong)] hover:bg-[var(--accent-15)] transition flex items-center justify-center gap-2"
            >
              <GitHubIcon className="w-4 h-4" />
              Sync Semua ke GitHub ({tunedFiles.filter((f) => uploadResults[f.id]?.success && uploadResults[f.id]?.assetId).length})
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

      {/* GitHub Export Modal */}
      <GitHubExportModal
        isOpen={showGitHubModal}
        onClose={() => setShowGitHubModal(false)}
        songs={exportSongs}
      />
    </div>
  );
}
