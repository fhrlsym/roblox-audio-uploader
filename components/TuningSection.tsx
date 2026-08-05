'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronRight, Loader2, Music, Trash2, Wand2 } from 'lucide-react';
import { RawAudioFile, TunedAudioFile } from '../types/audio';
import { processAudio } from '../lib/audioProcessor';
import { CARD, LABEL, BTN_PRIMARY, BTN_GHOST, cleanSongTitle } from '../lib/ui';
import { useToast } from './Toast';

interface TuningSectionProps {
  rawFiles: RawAudioFile[];
  onTuningComplete: (tunedFiles: TunedAudioFile[]) => void;
  onRemoveRaw: (id: string) => void;
  onNext?: () => void;
}

export default function TuningSection({ rawFiles, onTuningComplete, onRemoveRaw, onNext }: TuningSectionProps) {
  const { toast } = useToast();
  const [speed, setSpeed] = useState(2.3);
  const [amplify, setAmplify] = useState(-4);
  const [tuning, setTuning] = useState(false);
  const [progress, setProgress] = useState(0);

  const calculateRobloxSpeed = () => (1 / speed).toFixed(4);

  const fmtDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleTuneAll = async () => {
    if (rawFiles.length === 0) return;

    setTuning(true);
    setProgress(0);
    toast(`Memulai tuning ${rawFiles.length} file audio (Speed ${speed}x)...`, 'info');

    const results: TunedAudioFile[] = [];
    const succeededIds: string[] = [];

    for (let i = 0; i < rawFiles.length; i++) {
      const raw = rawFiles[i];

      try {
        let blob: Blob;

        if (raw.file) {
          blob = await processAudio(raw.file, speed, amplify, (p) => {
            setProgress(((i + p / 100) / rawFiles.length) * 100);
          });
        } else if (raw.fileId) {
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/api/download-file/${raw.fileId}`);
          if (!response.ok) throw new Error('File expired or not found');

          const arrayBuffer = await response.arrayBuffer();
          const file = new File([arrayBuffer], raw.name, { type: 'audio/mpeg' });

          blob = await processAudio(file, speed, amplify, (p) => {
            setProgress(((i + p / 100) / rawFiles.length) * 100);
          });
        } else {
          continue;
        }

        const tunedName = cleanSongTitle(raw.name) + '.mp3';

        results.push({
          id: `tuned_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          originalName: raw.name,
          tunedName,
          blob,
          speed,
          amplify,
          sourceId: raw.id,
        });
        succeededIds.push(raw.id);

        setProgress(((i + 1) / rawFiles.length) * 100);
      } catch (error) {
        console.error(`Failed to tune ${raw.name}:`, error);
      }
    }

    onTuningComplete(results);
    if (results.length > 0) {
      toast(`Berhasil men-tune ${results.length} file audio!`, 'success');
      onNext?.();
    } else {
      toast('Gagal men-tune file audio. Silakan coba lagi.', 'error');
    }
    // Refresh file list: remove files that were successfully tuned.
    const done = new Set(succeededIds);
    rawFiles.forEach((f) => {
      if (done.has(f.id)) onRemoveRaw(f.id);
    });
    setTuning(false);
    setProgress(0);
  };

  return (
    <div className={CARD + ' p-4'}>
      <h2 className="text-lg font-semibold text-[var(--text)] tracking-tight mb-4">2. Audio Tuning</h2>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className={LABEL}>File ({rawFiles.length})</p>
          {rawFiles.length > 0 && (
            <button
              onClick={() => rawFiles.forEach((f) => onRemoveRaw(f.id))}
              className="text-[11px] text-[var(--text-40)] hover:text-rose-300 transition"
            >
              Hapus semua
            </button>
          )}
        </div>

        {rawFiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] py-6 text-center">
            <Music className="mx-auto mb-2 w-6 h-6 text-[var(--text-30)]" />
            <p className="text-sm text-[var(--text-45)]">Belum ada file. Tambah dari Input Audio.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {rawFiles.map((file) => {
              const overLimit = file.video?.duration
                ? file.video.duration / speed >= 420
                : false;
              return (
                <div
                  key={file.id}
                  className={`flex items-center gap-3 rounded-xl border bg-[var(--surface)] p-2.5 transition ${
                    overLimit ? 'border-amber-400/25' : 'border-[var(--line)]'
                  }`}
                >
                  {file.video?.thumbnail ? (
                    <img
                      src={file.video.thumbnail}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-10 w-16 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]">
                      <Music className="w-4 h-4 text-[var(--text-40)]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[var(--text-90)]">
                      {cleanSongTitle(file.video?.title || file.name)}
                    </p>
                    <p className="truncate text-xs text-[var(--text-45)]">
                      {file.video
                        ? `${file.video.channel} · ${file.video.durationString}`
                        : file.file
                          ? `${(file.size || 0) / (1024 * 1024) > 1 ? ((file.size || 0) / (1024 * 1024)).toFixed(1) + ' MB' : Math.max(1, Math.round((file.size || 0) / 1024)) + ' KB'}`
                          : ''}
                    </p>
                    {overLimit && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-300/90">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        Setelah speed {speed}x jadi ~{fmtDuration(file.video!.duration! / speed)} — lebih dari 7 menit, ditolak Roblox.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveRaw(file.id)}
                    className="shrink-0 p-1.5 text-[var(--text-40)] transition hover:text-rose-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={LABEL}>Speed</label>
            <span className="font-mono text-sm text-[var(--accent-strong)]">{speed}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <p className="text-xs text-[var(--text-40)] mt-1.5">
            Roblox PlaybackSpeed:{' '}
            <span className="font-mono text-[var(--accent-soft)]">{calculateRobloxSpeed()}</span>
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={LABEL}>Amplify</label>
            <span className="font-mono text-sm text-emerald-400">{amplify > 0 ? '+' : ''}{amplify} dB</span>
          </div>
          <input
            type="range"
            min="-20"
            max="20"
            step="1"
            value={amplify}
            onChange={(e) => setAmplify(parseInt(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </div>
      </div>

      <button
        onClick={handleTuneAll}
        disabled={tuning || rawFiles.length === 0}
        className={BTN_PRIMARY + ' w-full py-3.5 shadow-[0_0_30px_var(--upload-glow)]'}
      >
        {tuning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Tuning… {Math.round(progress)}%
          </>
        ) : (
          <>
            <Wand2 className="w-4 h-4" />
            Tune Semua ({rawFiles.length})
          </>
        )}
      </button>

      {tuning && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-strong)]">
          <div
            className="h-full bg-gradient-to-r from-[var(--accent-deep)] to-[var(--accent-strong)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {onNext && rawFiles.length === 0 && !tuning && (
        <button onClick={onNext} className={BTN_GHOST + ' mt-3 w-full'}>
          Lanjut ke 3. Output & Upload
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
