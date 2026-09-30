'use client';

import { useState } from 'react';
import { CheckCircle2, Check, Copy, History, Music2, Search, Trash2, X } from 'lucide-react';
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
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'Active') return <CheckCircle2 className="w-3.5 h-3.5 text-[var(--emerald)] shrink-0" />;
  if (status === 'Copyright') return <Music2 className="w-3.5 h-3.5 text-rose-300 shrink-0" />;
  return null;
}

export default function UploadHistory({ history, onClose, onRefresh, refreshingIds = [], onOpenGitHubSync, limit = 5, onLoadMore, hasMore = false, isLoadingMore = false }: UploadHistoryProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Pending' | 'Failed' | 'Copyright'>('All');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [showAll, setShowAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

    let matchesDate = true;
    if (dateFilter !== 'all' && record.uploadedAt) {
      const age = Date.now() - record.uploadedAt;
      const dayMs = 24 * 60 * 60 * 1000;
      if (dateFilter === 'today') matchesDate = age < dayMs;
      else if (dateFilter === '7d') matchesDate = age < 7 * dayMs;
      else if (dateFilter === '30d') matchesDate = age < 30 * dayMs;
    }

    return matchesStatus && matchesSearch && matchesDate;
  });

  // Sort
  const sortedHistory = [...filteredHistory].sort((a, b) => {
    if (sortBy === 'name') {
      const na = (a.displayName || a.fileName || '').toLowerCase();
      const nb = (b.displayName || b.fileName || '').toLowerCase();
      return na.localeCompare(nb);
    }
    if (sortBy === 'oldest') return a.uploadedAt - b.uploadedAt;
    return b.uploadedAt - a.uploadedAt; // newest
  });

  const displayHistory = showAll ? sortedHistory : sortedHistory.slice(0, limit);
  const hasLocalMore = sortedHistory.length > limit;
  const activeCount = history.filter((r) => r.status === 'Active').length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === displayHistory.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayHistory.map((r) => r.id)));
    }
  };

  const handleBulkDelete = () => {
    // This would call a prop callback to delete from Supabase
    // For now, show toast indicating feature is wired
    if (selectedIds.size === 0) {
      toast('Pilih item dulu', 'error');
      return;
    }
    toast(`${selectedIds.size} item siap dihapus (wiring ke Supabase)`, 'info');
    setSelectedIds(new Set());
  };

  return (
    <Card className="brutal-card--static space-y-4 p-5">
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

      {/* Date filter & Sort row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border-2 border-[var(--text)] bg-[var(--bg)] p-1">
          {([['all', 'Semua'], ['today', 'Hari ini'], ['7d', '7 hari'], ['30d', '30 hari']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setDateFilter(id)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition whitespace-nowrap ${
                dateFilter === id
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'text-[var(--text-60)] hover:text-[var(--text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border-2 border-[var(--text)] bg-[var(--bg)] p-1">
          {([['newest', 'Terbaru'], ['oldest', 'Terlama'], ['name', 'Nama']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSortBy(id)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition whitespace-nowrap ${
                sortBy === id
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'text-[var(--text-60)] hover:text-[var(--text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedIds.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="inline-flex items-center gap-1 rounded-md border-2 border-[var(--text)] bg-[var(--danger)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-[2px_2px_0_0_var(--text)] transition active:translate-y-[1px]"
          >
            <Trash2 className="w-3 h-3" />
            Hapus ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Bulk select toggle */}
      {sortedHistory.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-60)] hover:text-[var(--text)] transition"
          >
            <span className={`flex h-4 w-4 items-center justify-center rounded border-2 border-[var(--text)] ${selectedIds.size === displayHistory.length && displayHistory.length > 0 ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--bg)]'}`}>
              {selectedIds.size === displayHistory.length && displayHistory.length > 0 && <Check className="h-3 w-3" />}
            </span>
            Pilih semua ({displayHistory.length})
          </button>
        </div>
      )}

      {/* History Items List */}
      {filteredHistory.length === 0 ? (
        <div className="brutal-card-sm py-8 text-center">
          <History className="mx-auto mb-2 w-6 h-6 text-[var(--text-40)]" />
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-50)]">
            {history.length === 0 ? 'Belum ada riwayat upload.' : 'Tidak ada hasil yang cocok.'}
          </p>
        </div>
      ) : (
        <div className="-mx-1 space-y-2 max-h-96 overflow-y-auto px-1 pb-1">
          {displayHistory.map((record) => {
            const isPending = record.status === 'Pending';
            return (
              <div
                key={record.id}
                className="brutal-card-sm group relative p-3 text-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <button
                      onClick={() => toggleSelect(record.id)}
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-[var(--text)] transition ${
                        selectedIds.has(record.id) ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--bg)]'
                      }`}
                      aria-label="Pilih item"
                    >
                      {selectedIds.has(record.id) && <Check className="h-3 w-3" />}
                    </button>
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
              </div>
            );
          })}

          {!showAll && hasLocalMore && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full py-2 text-xs font-bold uppercase tracking-wide text-[var(--accent)] hover:text-[var(--accent-deep)] transition"
            >
              Tampilkan semua ({sortedHistory.length} dimuat)
            </button>
          )}

          {showAll && hasLocalMore && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="w-full py-2 text-xs font-bold uppercase tracking-wide text-[var(--text-50)] hover:text-[var(--text)] transition"
            >
              Tampilkan lebih sedikit
            </button>
          )}

          {hasMore && showAll && (
            <button
              type="button"
              onClick={() => onLoadMore?.()}
              disabled={isLoadingMore}
              className="w-full py-2 text-xs font-bold uppercase tracking-wide text-[var(--accent)] hover:text-[var(--accent-deep)] transition disabled:opacity-60 disabled:cursor-wait"
            >
              {isLoadingMore ? 'Memuat…' : 'Muat lebih banyak'}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}