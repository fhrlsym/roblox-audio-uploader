'use client';

import { CheckCircle2, Copy, History, Music2, X } from 'lucide-react';
import { StatusBadge, RefreshBadge } from './StatusBadge';
import { cleanSongTitle, formatBytes, formatDate } from '../lib/utils';
import { UploadRecord } from '../types/audio';

interface UploadHistoryProps {
  history: UploadRecord[];
  onClose: () => void;
  onRefresh?: (assetId: string) => Promise<void>;
  refreshingIds?: string[];
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'Active') return <CheckCircle2 className="w-3 h-3 text-[var(--emerald)] shrink-0" />;
  if (status === 'Copyright') return <Music2 className="w-3 h-3 text-rose-300 shrink-0" />;
  return null;
}

export default function UploadHistory({ history, onClose, onRefresh, refreshingIds = [] }: UploadHistoryProps) {
  const copyAssetId = (assetId: string) => {
    navigator.clipboard.writeText(assetId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-enter w-full max-w-2xl rounded-2xl border border-[var(--accent-15)] bg-[var(--panel)] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--line)]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[var(--accent-soft)]" />
            <h3 className="text-base font-semibold text-[var(--text)]">Riwayat Upload</h3>
            {history.length > 0 && (
              <span className="rounded-full bg-[var(--surface-strong)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-45)]">
                {history.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-40)] transition hover:text-[var(--text)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {history.length === 0 ? (
          <div className="py-12 text-center">
            <History className="mx-auto mb-2 w-6 h-6 text-[var(--text-30)]" />
            <p className="text-sm text-[var(--text-45)]">Belum ada riwayat upload.</p>
          </div>
        ) : (
          <div className="overflow-y-auto divide-y divide-[var(--line)]">
            {history.map((record) => {
              const isPending = record.status === 'Pending';
              return (
                <div key={record.id} className="group p-4 sm:p-5 transition hover:bg-[var(--surface)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-90)]">
                        {cleanSongTitle(record.displayName || record.fileName)}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-40)]">
                        <StatusIcon status={record.status || 'Pending'} />
                        <span className="truncate">{record.accountName}</span>
                        {record.fileSize ? <span>· {formatBytes(record.fileSize)}</span> : null}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-[11px] text-[var(--text-35)]"
                      title={new Date(record.uploadedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    >
                      {formatDate(record.uploadedAt)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => copyAssetId(record.assetId)}
                      className="group/id inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-50)] px-2.5 py-1.5 transition hover:border-[var(--accent-30)]"
                      title="Salin Asset ID"
                    >
                      <code className="truncate text-[11px] text-[var(--accent-soft)] font-mono">{record.assetId}</code>
                      <Copy className="w-3 h-3 shrink-0 text-[var(--text-35)] transition group-hover/id:text-[var(--accent-soft)]" />
                    </button>

                    {record.robloxPlaybackSpeed && (
                      <span
                        className="rounded-lg border border-[var(--accent-20)] bg-[var(--accent-06)] px-2 py-1 text-[11px] font-mono text-[var(--accent-soft)]"
                        title="Roblox Studio PlaybackRate"
                      >
                        Playback {record.robloxPlaybackSpeed}
                      </span>
                    )}

                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      <StatusBadge status={record.status || 'Pending'} />
                      {isPending && onRefresh && (
                        <RefreshBadge
                          busy={refreshingIds.includes(record.assetId)}
                          onClick={() => onRefresh(record.assetId)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}