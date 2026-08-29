'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ChevronRight, Loader2, Music, ShieldCheck, Sliders, Trash2, Zap } from 'lucide-react';
import { RawAudioFile, TunedAudioFile } from '../types/audio';
import { processAudio } from '../lib/audioProcessor';
import { LABEL, BTN_PRIMARY, BTN_GHOST, cleanSongTitle } from '../lib/ui';
import { useToast } from './Toast';
import { Card } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import { ProgressBar } from './ui/ProgressBar';
import Waveform from './Waveform';

interface TuningSectionProps {
  rawFiles: RawAudioFile[];
  onTuningComplete: (tunedFiles: TunedAudioFile[]) => void;
  onRemoveRaw: (id: string) => void;
  onNext?: () => void;
  backendUrl?: string;
}

export default function TuningSection({ rawFiles, onTuningComplete, onRemoveRaw, onNext, backendUrl }: TuningSectionProps) {
  const { toast } = useToast();
  const [speed, setSpeed] = useState(2.3);
  const [amplify, setAmplify] = useState(-4);
  const [tuning, setTuning] = useState(false);
  const [progress, setProgress] = useState(0);

  const calculateRobloxSpeed = () => (1 / speed).toFixed(4);

  const fmtDuration = (seconds: number) => {
    const total = Math.max(1, Math.round(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
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
          const response = await fetch(`${backendUrl || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/api/download-file/${raw.fileId}`);
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
    <Card className="p-4">
      <h2 className="text-lg font-extrabold uppercase tracking-wide text-[var(--text)] mb-4">2. Audio Tuning</h2>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className={LABEL}>File ({rawFiles.length})</p>
          {rawFiles.length > 0 && (
            <button
              onClick={() => rawFiles.forEach((f) => onRemoveRaw(f.id))}
              className="text-[11px] font-bold uppercase tracking-wide text-[var(--danger)] hover:text-[var(--text)] transition"
            >
              Hapus semua
            </button>
          )}
        </div>

        {rawFiles.length === 0 ? (
          <EmptyState
            icon={<Music className="h-5 w-5" />}
            title="Belum ada file"
            description="Tambahkan audio dari tab Input (file lokal, YouTube, atau SoundCloud) lalu kembali ke sini."
          />
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            <AnimatePresence>
              {rawFiles.map((file, index) => {
                const overLimit = file.video?.duration
                  ? file.video.duration / speed >= 420
                  : false;
                return (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, height: 0, y: 6 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -6 }}
                    transition={{ duration: 0.2, delay: index * 0.04 }}
                    className={`brutal-card-sm flex items-center gap-3 p-2.5 ${
                      overLimit ? 'bg-[var(--danger)]/10' : ''
                    }`}
                  >
                    {file.video?.thumbnail ? (
                      <img
                        src={file.video.thumbnail}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-10 w-16 shrink-0 rounded-md border-2 border-[var(--text)] object-cover"
                      />
                    ) : (
                      <div className="brutal-icon-box flex h-10 w-16 shrink-0 justify-center bg-[var(--bg)] text-[var(--text-50)]">
                        <Music className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[var(--text-90)]">
                        {cleanSongTitle(file.video?.title || file.name)}
                      </p>
                      <p className="truncate text-xs font-medium text-[var(--text-50)]">
                        {file.video
                          ? `${file.video.channel} · ${file.video.durationString}`
                          : file.file
                            ? `${(file.size || 0) / (1024 * 1024) > 1 ? ((file.size || 0) / (1024 * 1024)).toFixed(1) + ' MB' : Math.max(1, Math.round((file.size || 0) / 1024)) + ' KB'}`
                            : ''}
                      </p>
                      {overLimit && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[var(--danger)]">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Setelah speed {speed}x jadi ~{fmtDuration(file.video!.duration! / speed)} — lebih dari 7 menit, ditolak Roblox.
                        </p>
                      )}
                      {file.file && <Waveform file={file} speed={speed} className="mt-2" />}
                    </div>
                    <button
                      onClick={() => onRemoveRaw(file.id)}
                      className="shrink-0 rounded-md border-2 border-[var(--text)] bg-[var(--bg)] p-1.5 text-[var(--text)] transition hover:bg-[var(--danger)] hover:text-white active:translate-y-[1px]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Presets */}
      <div className="mb-5 space-y-2">
        <div className="flex items-center justify-between">
          <p className={LABEL}>Preset</p>
          <span className="text-[11px] font-mono font-bold uppercase text-[var(--accent)]">
            {speed === 2.3 && amplify === -4
              ? 'Roblox Standard'
              : speed === 2.75 && amplify === -6
                ? 'Fast & Clear'
                : speed === 1.8 && amplify === -2
                  ? 'Deep & Warm'
                  : 'Custom'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'standard', label: 'Roblox Standard', badge: '2.3x · -4dB', icon: ShieldCheck, s: 2.3, a: -4 },
            { id: 'aggressive', label: 'Fast & Clear', badge: '2.75x · -6dB', icon: Zap, s: 2.75, a: -6 },
            { id: 'light', label: 'Deep & Warm', badge: '1.8x · -2dB', icon: Music, s: 1.8, a: -2 },
            { id: 'custom', label: 'Custom', badge: 'Manual', icon: Sliders, s: null, a: null },
          ].map((preset) => {
            const Icon = preset.icon;
            const isMatch =
              preset.s !== null
                ? speed === preset.s && amplify === preset.a
                : !(
                    (speed === 2.3 && amplify === -4) ||
                    (speed === 2.75 && amplify === -6) ||
                    (speed === 1.8 && amplify === -2)
                  );

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  if (preset.s !== null && preset.a !== null) {
                    setSpeed(preset.s);
                    setAmplify(preset.a);
                    toast(`Preset diterapkan: ${preset.label} (${preset.badge})`, 'info');
                  }
                }}
                className={`flex flex-col items-start p-2.5 rounded-lg border-2 border-[var(--text)] text-left transition-all duration-150 ${
                  isMatch
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-[3px_3px_0_0_var(--text)]'
                    : 'bg-[var(--panel)] text-[var(--text)] hover:-translate-y-[1px] hover:shadow-[3px_3px_0_0_var(--text)]'
                }`}
              >
                <div className="flex items-center gap-1.5 w-full">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold uppercase truncate">
                    {preset.label}
                  </span>
                </div>
                <span className="text-[10px] mt-1 font-mono opacity-80">
                  {preset.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={LABEL}>Speed</label>
            <span className="font-mono text-sm font-bold text-[var(--accent)]">{speed}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.05"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <p className="text-xs font-medium text-[var(--text-50)] mt-1.5">
            Roblox PlaybackSpeed:{' '}
            <span className="font-mono font-bold text-[var(--accent)]">{calculateRobloxSpeed()}</span>
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={LABEL}>Amplify</label>
            <span className="font-mono text-sm font-bold text-[var(--emerald)]">{amplify > 0 ? '+' : ''}{amplify} dB</span>
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
        className={BTN_PRIMARY + ' w-full py-3.5'}
      >
        {tuning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Tuning… {Math.round(progress)}%
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Tune Semua ({rawFiles.length})
          </>
        )}
      </button>

      {tuning && (
        <div className="mt-3">
          <ProgressBar value={progress} />
        </div>
      )}

      {onNext && rawFiles.length === 0 && !tuning && (
        <button onClick={onNext} className={BTN_GHOST + ' mt-3 w-full'}>
          Lanjut ke 3. Output & Upload
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </Card>
  );
}
