'use client';

import { useState } from 'react';
import { CloudUpload, Copy, Download, Loader2, Music, Trash2 } from 'lucide-react';
import { TunedAudioFile, UploadResult } from '../types/audio';
import { StatusBadge } from './StatusBadge';
import { useToast } from './Toast';
import { CARD, BTN_PRIMARY, BTN_GHOST } from '../lib/ui';

interface AccountLike {
  id: string;
  name: string;
  type: 'user' | 'group';
  apiKey: string;
}

interface UploadRecordResult {
  id: string;
  fileName: string;
  displayName: string;
  assetId: string;
  accountName: string;
  uploadedAt: number;
  fileSize?: number;
  duration?: number;
  status?: string;
}

interface OutputSectionProps {
  tunedFiles: TunedAudioFile[];
  onRemoveTuned: (id: string) => void;
  backendUrl: string;
  selectedAccount: AccountLike | null;
  onUploadSuccess?: (record: UploadRecordResult) => void;
}

export default function OutputSection({ tunedFiles, onRemoveTuned, backendUrl, selectedAccount, onUploadSuccess }: OutputSectionProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadResults, setUploadResults] = useState<Record<string, UploadResult>>({});

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

  const handleUploadToRoblox = async (file: TunedAudioFile) => {
    if (!selectedAccount || !selectedAccount.apiKey) {
      toast('Pilih akun Roblox terlebih dahulu di bagian Roblox Account', 'error');
      return;
    }

    setUploading((prev) => ({ ...prev, [file.id]: true }));

    try {
      const formData = new FormData();
      formData.append('file', file.blob, file.tunedName);
      formData.append('displayName', file.tunedName);
      formData.append('description', `Speed: ${file.speed}x | Amplify: ${file.amplify}dB | Roblox Playback: ${(1 / file.speed).toFixed(4)}`);
      formData.append('creatorType', selectedAccount.type);
      formData.append('creatorId', selectedAccount.id);
      formData.append('apiKey', selectedAccount.apiKey);

      const response = await fetch(`${backendUrl}/api/upload-to-roblox`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.operationId) {
        let assetId: string | null = null;
        let status = 'Pending';
        let opError: string | null = null;

        for (let attempt = 0; attempt < 120; attempt++) {
          await new Promise((r) => setTimeout(r, 3000));

          const opResponse = await fetch(
            `${backendUrl}/api/operation-status/${data.operationId}?apiKey=${encodeURIComponent(selectedAccount.apiKey)}`
          );
          const opData = await opResponse.json();

          if (opData.done) {
            if (opData.assetId) {
              assetId = opData.assetId;
              status = opData.status || 'Pending';
            } else {
              opError = opData.error || 'Upload failed during moderation';
            }
            break;
          }
        }

        if (assetId) {
          setUploadResults((prev) => ({
            ...prev,
            [file.id]: { filename: file.tunedName, assetId, status, success: true },
          }));

          if (onUploadSuccess) {
            onUploadSuccess({
              id: `${Date.now()}-${file.id}`,
              fileName: file.tunedName,
              displayName: file.tunedName,
              assetId,
              accountName: selectedAccount.name,
              uploadedAt: Date.now(),
              fileSize: file.blob.size,
              status,
            });
          }
        } else {
          setUploadResults((prev) => ({
            ...prev,
            [file.id]: { filename: file.tunedName, error: opError || 'Upload timeout', success: false },
          }));
        }
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setUploadResults((prev) => ({
        ...prev,
        [file.id]: { filename: file.tunedName, error: message, success: false },
      }));
    } finally {
      setUploading((prev) => ({ ...prev, [file.id]: false }));
    }
  };

  return (
    <div className={CARD + ' p-6'}>
      <h2 className="text-lg font-semibold text-[var(--text)] tracking-tight mb-5">3. Output & Upload</h2>

      {tunedFiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] py-12 text-center">
          <Music className="mx-auto mb-2 w-6 h-6 text-[var(--text-30)]" />
          <p className="text-sm text-[var(--text-45)]">Belum ada file yang di-tune.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tunedFiles.map((file) => {
            const result = uploadResults[file.id];
            const isUploading = uploading[file.id];

            return (
              <div
                key={file.id}
                className={`stagger-enter rounded-xl border p-4 transition ${
                  result?.success
                    ? 'border-emerald-400/15 bg-emerald-400/[0.04]'
                    : result
                      ? 'border-rose-400/15 bg-rose-400/[0.04]'
                      : 'border-[var(--line)] bg-[var(--surface)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-90)]">{file.tunedName}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-45)]">
                      Speed {file.speed}x · Amplify {file.amplify > 0 ? '+' : ''}{file.amplify}dB · Playback{' '}
                      <span className="font-mono text-[var(--accent-soft)]">{(1 / file.speed).toFixed(4)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveTuned(file.id)}
                    className="shrink-0 p-1.5 text-[var(--text-40)] transition hover:text-rose-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {result && (
                  <div className="mt-3">
                    {result.success ? (
                      <div className="rounded-xl border border-[var(--accent-20)] bg-[var(--accent-06)] p-4">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={result.status || 'Pending'} />
                          <button
                            onClick={() => copySongInfo(file.tunedName, result.assetId!, (1 / file.speed).toFixed(4))}
                            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent-deep)] px-3 py-1.5 text-[11px] font-semibold text-[var(--on-accent)] transition hover:brightness-110 active:scale-[0.97]"
                          >
                            <Copy className="w-3 h-3" />
                            Salin 3 info
                          </button>
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
                              rbxassetid://{result.assetId}
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

                <div className="mt-4 flex gap-2">
                  <button onClick={() => handleDownload(file)} className={BTN_GHOST + ' flex-1'}>
                    <Download className="w-4 h-4" />
                    MP3
                  </button>
                  <button
                    onClick={() => handleUploadToRoblox(file)}
                    disabled={isUploading || !!result}
                    className={BTN_PRIMARY + ' flex-1'}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading…
                      </>
                    ) : result?.success ? (
                      <>
                        <CloudUpload className="w-4 h-4" />
                        Uploaded
                      </>
                    ) : (
                      <>
                        <CloudUpload className="w-4 h-4" />
                        Upload ke Roblox
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
