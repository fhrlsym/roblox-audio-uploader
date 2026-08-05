'use client';

import { Copy, History, Trash2 } from 'lucide-react';
import { StatusBadge, RefreshBadge } from './StatusBadge';
import { CARD } from '../lib/ui';
import { cleanSongTitle, formatBytes, formatDate } from '../lib/utils';
import { UploadRecord } from '../types/audio';

interface UploadHistoryProps {
  history: UploadRecord[];
  onClear: () => void;
  onRefresh?: (assetId: string) => Promise<void>;
  refreshingIds?: string[];
}

export default function UploadHistory({ history, onClear, onRefresh, refreshingIds = [] }: UploadHistoryProps) {
  const copyAssetId = (assetId: string) => {
    navigator.clipboard.writeText(assetId);
  };

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center justify-between p-5 border-b border-[var(--line)]">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[var(--accent-soft)]" />
          <h3 className="text-base font-semibold text-[var(--text)]">Riwayat Upload</h3>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs text-[var(--text-40)] transition hover:text-rose-300"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hapus semua
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="py-12 text-center">
          <History className="mx-auto mb-2 w-6 h-6 text-[var(--text-30)]" />
          <p className="text-sm text-[var(--text-45)]">Belum ada riwayat upload.</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--line)] max-h-96 overflow-y-auto">
          {history.map((record) => (
            <div key={record.id} className="flex items-center gap-3 p-4 transition hover:bg-[var(--surface)]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-[var(--text-90)]">{cleanSongTitle(record.displayName || record.fileName)}</p>
                  <span className="text-xs text-[var(--text-35)] flex-shrink-0">{formatDate(record.uploadedAt)}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[var(--text-45)]">
                  {record.accountName}
                  {record.fileSize ? ` · ${formatBytes(record.fileSize)}` : ''}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {record.robloxPlaybackSpeed && (
                  <span className="rounded-lg border border-[var(--accent-20)] bg-[var(--accent-06)] px-2 py-1 text-[11px] font-mono text-[var(--accent-soft)]" title="Roblox Studio PlaybackRate">
                    Playback: <strong className="font-semibold">{record.robloxPlaybackSpeed}</strong>
                  </span>
                )}
                <button
                  onClick={() => copyAssetId(record.assetId)}
                  className="group flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 transition hover:border-[var(--accent-30)]"
                  title="Salin asset ID"
                >
                  <code className="text-[11px] text-[var(--accent-soft)] font-mono">
                    {record.assetId}
                  </code>
                  <Copy className="w-3 h-3 text-[var(--text-40)] transition group-hover:text-[var(--accent-soft)]" />
                </button>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={record.status || 'Pending'} />
                {record.status === 'Pending' && onRefresh && (
                  <RefreshBadge
                    busy={refreshingIds.includes(record.assetId)}
                    onClick={() => onRefresh(record.assetId)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
