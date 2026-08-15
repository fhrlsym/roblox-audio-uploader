'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Copy, History, Music2, Search, X } from 'lucide-react';
import { StatusBadge, RefreshBadge } from './StatusBadge';
import { cleanSongTitle, formatBytes, formatDate } from '../lib/utils';
import { UploadRecord } from '../types/audio';
import { CARD, INPUT, BTN_GHOST } from '../lib/ui';
import { useToast } from './Toast';
import { GitHubIcon } from './GitHubExportModal';

interface UploadHistoryProps {
  history: UploadRecord[];
  onClose?: () => void;
  onRefresh?: (assetId: string) => Promise<void>;
  refreshingIds?: string[];
  onOpenGitHubSync?: () => void;
  limit?: number;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'Active') return <CheckCircle2 className="w-3.5 h-3.5 text-[var(--emerald)] shrink-0" />;
  if (status === 'Copyright') return <Music2 className="w-3.5 h-3.5 text-rose-300 shrink-0" />;
  return null;
}

export default function UploadHistory({ history, onClose, onRefresh, refreshingIds = [], onOpenGitHubSync, limit = 5 }: UploadHistoryProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Pending' | 'Failed' | 'Copyright'>('All');
  const [showAll, setShowAll] = useState(false);

  const copyAssetId = (assetId: string) => {
    navigator.clipboard.writeText(assetId);
    toast('Asset ID disalin', 'success');
  };

  const copyAllActiveIds = () => {
    const activeItems = history.filter((r) => r.status === 'Active' && r.assetId);
    if (activeItems.length === 0) {
      toast('Tidak ada Asset ID berstatus Active', 'error');
      return;
    }
    const ids = activeItems.map((r) => r.assetId).join('\n');
    navigator.clipboard.writeText(ids);
    toast(`Berhasil menyalin ${activeItems.length} Asset ID Active!`, 'success');
  };

  const filteredHistory = history.filter((record) => {
    const matchesStatus = statusFilter === 'All' || record.status === statusFilter;
    const nameStr = (record.displayName || record.fileName || '').toLowerCase();
    const idStr = (record.assetId || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || nameStr.includes(q) || idStr.includes(q);
    return matchesStatus && matchesSearch;
  });

  const displayHistory = showAll ? filteredHistory : filteredHistory.slice(0, limit);
  const hasMore = filteredHistory.length > limit;

  const activeCount = history.filter((r) => r.status === 'Active').length;

  return (
    <div className={`${CARD} p-5 space-y-4 shadow-xl border border-[var(--line)] bg-[var(--panel)]`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent-15)] flex items-center justify-center text-[var(--accent)]">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text)] tracking-tight">Riwayat Upload Audio</h3>
            <p className="text-[11px] text-[var(--text-45)]">
              {history.length} item tersimpan di Supabase database
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeCount > 0 && (
            <>
              {onOpenGitHubSync && (
                <button
                  type="button"
                  onClick={onOpenGitHubSync}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent-deep)] px-3 py-1.5 text-[11px] font-semibold text-[var(--on-accent)] transition hover:brightness-110 active:scale-[0.97]"
                >
                  <GitHubIcon className="w-3.5 h-3.5" />
                  Sync ke GitHub ({activeCount})
                </button>
              )}

              <button
                type="button"
                onClick={copyAllActiveIds}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-15)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent-20)] transition"
              >
                <Copy className="w-3 h-3" />
                Copy ID
              </button>
            </>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[var(--text-40)] hover:text-[var(--text)] transition rounded-lg hover:bg-[var(--surface)]"
              title="Tutup Riwayat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-40)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari lagu atau Asset ID..."
            className={`${INPUT} pl-9 py-1.5 text-xs`}
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl bg-[var(--surface-50)] border border-[var(--line)]">
          {(['All', 'Active', 'Pending', 'Failed', 'Copyright'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-[var(--accent)] text-[#000000] font-bold'
                  : 'text-[var(--text-60)] hover:text-[var(--text)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* History Items List */}
      {filteredHistory.length === 0 ? (
        <div className="empty-state py-8 text-center rounded-xl border border-dashed border-[var(--line)]">
          <History className="mx-auto mb-2 w-6 h-6 text-[var(--text-30)]" />
          <p className="text-xs text-[var(--text-45)]">
            {history.length === 0 ? 'Belum ada riwayat upload.' : 'Tidak ada hasil yang cocok.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {displayHistory.map((record, index) => {
            const isPending = record.status === 'Pending';
            return (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, transform: 'translateY(6px)' }}
                animate={{ opacity: 1, transform: 'translateY(0)' }}
                transition={{ duration: 0.18, delay: index * 0.035, ease: [0.23, 1, 0.32, 1] }}
                className="group rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-xs transition hover:border-[var(--accent-25)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={record.status || 'Pending'} />
                      <p className="truncate text-xs font-semibold text-[var(--text-90)]">
                        {cleanSongTitle(record.displayName || record.fileName)}
                      </p>
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-45)]">
                      <span className="truncate">{record.accountName}</span>
                      {record.fileSize ? <span>· {formatBytes(record.fileSize)}</span> : null}
                      <span>· {formatDate(record.uploadedAt)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={record.status || 'Pending'} />
                    {isPending && onRefresh && (
                      <RefreshBadge
                        busy={refreshingIds.includes(record.assetId)}
                        onClick={() => onRefresh(record.assetId)}
                      />
                    )}
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-[var(--line)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => copyAssetId(record.assetId)}
                      className="group/id inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-50)] px-2 py-1 transition hover:border-[var(--accent-30)]"
                      title="Salin Asset ID"
                    >
                      <span className="text-[10px] text-[var(--text-40)] font-mono">ID:</span>
                      <code className="truncate text-[11px] font-bold text-[var(--accent-soft)] font-mono">
                        {record.assetId}
                      </code>
                      <Copy className="w-3 h-3 shrink-0 text-[var(--text-35)] transition group-hover/id:text-[var(--accent-soft)]" />
                    </button>

                    {record.robloxPlaybackSpeed && (
                      <span
                        className="rounded-lg border border-[var(--accent-20)] bg-[var(--accent-06)] px-2 py-1 text-[10px] font-mono text-[var(--accent-soft)] shrink-0"
                        title="Roblox Studio PlaybackRate"
                      >
                        Playback: {record.robloxPlaybackSpeed}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          
          {hasMore && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full py-2 text-xs font-medium text-[var(--accent-soft)] hover:text-[var(--accent)] transition"
            >
              Lihat semua ({filteredHistory.length - limit} lainnya)
            </button>
          )}
          
          {showAll && hasMore && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="w-full py-2 text-xs font-medium text-[var(--text-50)] hover:text-[var(--text)] transition"
            >
              Tampilkan lebih sedikit
            </button>
          )}
        </div>
      )}
    </div>
  );
}