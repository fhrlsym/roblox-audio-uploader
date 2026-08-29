'use client';

import { motion } from 'framer-motion';
import { Clock, Headphones, Loader2, Music, Play, Trash2 } from 'lucide-react';
import { cleanSongTitle } from '../../lib/utils';
import type { VideoInfo } from '../../types/audio';

interface LinkQueueItemProps {
  url: string;
  loading?: boolean;
  video?: VideoInfo | null;
  error?: string;
  index: number;
  placeholderIcon?: 'youtube' | 'soundcloud';
  onRemove?: () => void;
  onRetry?: () => void;
}

export function LinkQueueItem({
  url,
  loading = false,
  video,
  error,
  index,
  placeholderIcon = 'youtube',
  onRemove,
  onRetry,
}: LinkQueueItemProps) {
  const PlaceholderIcon = placeholderIcon === 'youtube' ? Play : Headphones;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, y: 6 }}
      animate={{ opacity: 1, height: 'auto', y: 0 }}
      exit={{ opacity: 0, height: 0, y: -6 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className={`flex items-center gap-2.5 rounded-lg border-2 border-[var(--text)] bg-[var(--panel)] p-2 shadow-[3px_3px_0_0_var(--text)] transition sm:gap-3 sm:p-2.5 ${
        error ? 'border-[var(--danger)]' : 'hover:shadow-[4px_4px_0_0_var(--text)]'
      }`}
    >
      {loading ? (
        <>
          <div className="h-10 w-14 shrink-0 animate-pulse rounded-lg bg-[var(--bg)] sm:h-12 sm:w-20" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--bg)]" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-[var(--bg)]" />
          </div>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--accent-soft)]" />
        </>
      ) : video ? (
        <>
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt=""
              referrerPolicy="no-referrer"
              className="h-10 w-14 shrink-0 rounded-lg object-cover sm:h-12 sm:w-20"
            />
          ) : (
            <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-[var(--text)] bg-[var(--bg)] sm:h-12 sm:w-20">
              <Music className="h-5 w-5 text-[var(--text-40)]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--text-90)]">{cleanSongTitle(video.title)}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-50)]">
              <Clock className="h-3 w-3" />
              {video.channel || 'Audio'} · {video.durationString}
            </p>
          </div>
          {onRemove && (
            <button onClick={onRemove} className="shrink-0 p-1.5 text-[var(--text-40)] transition hover:text-[var(--danger)]" aria-label="Hapus dari antrian">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </>
      ) : (
        <>
          <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg border-2 border-[var(--text)] bg-[var(--danger)]/10">
            <PlaceholderIcon className="h-5 w-5 text-[var(--danger)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-[var(--text-60)]">{url}</p>
            {error && <p className="mt-0.5 text-xs text-[var(--danger)]">{error}</p>}
          </div>
          {onRetry && (
            <button onClick={onRetry} className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[var(--accent-strong)] transition hover:text-[var(--text)]">
              Coba lagi
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove} className="shrink-0 p-1.5 text-[var(--text-40)] transition hover:text-[var(--danger)]" aria-label="Hapus dari antrian">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </motion.div>
  );
}
