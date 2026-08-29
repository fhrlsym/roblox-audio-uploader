'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Copy, History, Music2, Search, X } from 'lucide-react';
import { StatusBadge, RefreshBadge } from './StatusBadge';
import { cleanSongTitle, formatBytes, formatDate } from '../lib/utils';
import { UploadRecord } from '../types/audio';
import { INPUT } from '../lib/ui';
import { useToast } from './Toast';
import { GitHubIcon } from './GitHubExportModal';
import { Card } from './ui/Card';

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
    <Card className="space-y-4 p-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-[var(--text)]">
        <div className="flex items-center gap-2.5">
          <div className="brutal-icon-box w-8 h-8 bg-[var(--accent)] text-[var(--on-accent)]">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--text)]">Riwayat Upload Audio</h3>
            <p className="text-[11px] font-medium text-[var(--text-50)]">
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
                  className="inline-flex items-center gap-1.5 rounded-md border-2 border-[var(--text)] bg-[var(--accent)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--on-accent)] shadow-[2px_2px_0_0_var(--text)] transition hover:-translate-y-[1px] hover:shadow-[3px_3px_0_0_var(--text)] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--text)]"
                >
                  <GitHubIcon className="w-3.5 h-3.5" />
                  Sync ke GitHub ({activeCount})
                </button>
              )}

              <button
                type="button"
                onClick={copyAllActiveIds}
                className="inline-flex items-center gap-1.5 rounded-md border-2 border-[var(--text)] bg-[var(--panel)] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text)] shadow-[2px_2px_0_0_var(--text)] transition hover:-translate-y-[1px] hover:shadow-[3px_3px_0_0_var(--text)] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--text)]"
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
              className="rounded-md border-2 border-[var(--text)] bg-[var(--panel)] p-1.5 text-[var(--text)] transition hover:bg-[var(--accent)] hover:text-[var(--on-accent)] active:translate-y-[1px]"
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-50)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari lagu atau Asset ID..."
            className={`${INPUT} pl-9 py-1.5 text-xs`}
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto rounded-lg border-2 border-[var(--text)] bg-[var(--bg)] p-1 shadow-[2px_2px_0_0_var(--text)]">
          {(['All', 'Active', 'Pending', 'Failed', 'Copyright'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide transition whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
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
        <div className="brutal-card-sm py-8 text-center">
          <History className="mx-auto mb-2 w-6 h-6 text-[var(--text-40)]" />
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-50)]">
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
                className="brutal-card-sm group p-3 text-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={record.status || 'Pending'} />
                      <p className="truncate text-xs font-bold text-[var(--text-90)]">
                        {cleanSongTitle(record.displayName || record.fileName)}
                      </p>
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-[11px] font-medium text-[var(--text-50)]">
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

                <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t-2 border-[var(--text)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => copyAssetId(record.assetId)}
                      className="group/id inline-flex items-center gap-1.5 rounded-md border-2 border-[var(--text)] bg-[var(--bg)] px-2 py-1 transition hover:bg-[var(--accent)] hover:text-[var(--on-accent)] active:translate-y-[1px]"
                      title="Salin Asset ID"
                    >
                      <span className="text-[10px] font-bold uppercase text-[var(--text-50)]">ID:</span>
                      <code className="truncate text-[11px] font-bold font-mono">
                        {record.assetId}
                      </code>
                      <Copy className="w-3 h-3 shrink-0" />
                    </button>

                    {record.robloxPlaybackSpeed && (
                      <span
                        className="rounded-md border-2 border-[var(--text)] bg-[var(--accent)] px-2 py-1 text-[10px] font-bold font-mono text-[var(--on-accent)] shrink-0"
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
              className="w-full py-2 text-xs font-bold uppercase tracking-wide text-[var(--accent)] hover:text-[var(--accent-deep)] transition"
            >
              Lihat semua ({filteredHistory.length - limit} lainnya)
            </button>
          )}

          {showAll && hasMore && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="w-full py-2 text-xs font-bold uppercase tracking-wide text-[var(--text-50)] hover:text-[var(--text)] transition"
            >
              Tampilkan lebih sedikit
            </button>
          )}
        </div>
      )}
    </Card>
  );
}