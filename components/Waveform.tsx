'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { RawAudioFile } from '../types/audio';

interface WaveformProps {
  file: RawAudioFile;
  speed?: number;
  className?: string;
}

const BINS = 56;

function fallbackPeaks(seedStr: string): number[] {
  // Pola deterministik dari nama file — dipakai saat decode gagal / bukan file lokal.
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const peaks: number[] = [];
  for (let i = 0; i < BINS; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const t = i / BINS;
    const env = 0.25 + 0.75 * Math.sin(Math.PI * t);
    peaks.push(Math.min(1, ((seed % 100) / 100) * env + 0.08));
  }
  return peaks;
}

export default function Waveform({ file, speed = 1, className = '' }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [hasAudio, setHasAudio] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    const load = async () => {
      try {
        const source = file.file ?? null;
        if (!source) {
          setPeaks(fallbackPeaks(file.name));
          return;
        }
        const ab = await source.arrayBuffer();
        const ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        let buffer: AudioBuffer;
        try {
          buffer = await ctx.decodeAudioData(ab);
        } finally {
          try { await ctx.close(); } catch { /* ignore */ }
        }

        if (cancelled) return;

        const data = buffer.getChannelData(0);
        const step = Math.max(1, Math.floor(data.length / BINS));
        const computed: number[] = [];
        for (let i = 0; i < BINS; i++) {
          let peak = 0;
          for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j++) {
            const v = Math.abs(data[j]);
            if (v > peak) peak = v;
          }
          computed.push(Math.min(1, peak * 1.6));
        }
        if (cancelled) return;
        setPeaks(computed);
        setDuration(buffer.duration);

        if (file.file) {
          url = URL.createObjectURL(file.file);
          const audio = new Audio(url);
          audio.volume = 0.6;
          audio.addEventListener('ended', () => setPlaying(false));
          audioRef.current = audio;
          setHasAudio(true);
        }
      } catch {
        if (!cancelled) setPeaks(fallbackPeaks(file.name));
      }
    };

    load();
    return () => {
      cancelled = true;
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        if (audio.src) URL.revokeObjectURL(audio.src);
      }
      if (url) URL.revokeObjectURL(url);
      audioRef.current = null;
      setPlaying(false);
      setHasAudio(false);
    };
  }, [file]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  }, [playing]);

  const fmt = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Gambar waveform ke canvas setiap peaks berubah
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const gap = 2;
    const barWidth = Math.max(1, (width - gap * (BINS - 1)) / BINS);
    const mid = height / 2;
    const data = peaks.length === BINS ? peaks : Array(BINS).fill(0.12);
    const color = getComputedStyle(canvas).color;

    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < BINS; i++) {
      const h = Math.max(2, data[i] * (height - 4));
      const x = i * (barWidth + gap);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55 + 0.45 * data[i];
      // rounded top via fillRect + arc (roundRect butuh font ter-load, rawan crash)
      const radius = Math.min(1.5, barWidth / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x, mid - h / 2 + radius);
      ctx.lineTo(x, mid + h / 2);
      ctx.lineTo(x + barWidth, mid + h / 2);
      ctx.lineTo(x + barWidth, mid - h / 2 + radius);
      ctx.arcTo(x + barWidth, mid - h / 2, x + barWidth - radius, mid - h / 2, radius);
      ctx.arcTo(x + barWidth, mid - h / 2, x, mid - h / 2, radius);
      ctx.arcTo(x, mid - h / 2, x, mid - h / 2 + radius, radius);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [peaks]);

  useEffect(() => {
    draw();
    // Redraw saat ukuran berubah (mis. list file tersembunyi lalu terlihat, atau resize)
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  const effDuration = duration !== null ? duration / speed : null;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={togglePlay}
        disabled={!hasAudio}
        aria-label={playing ? 'Jeda preview' : 'Putar preview'}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--text-60)] transition hover:border-[var(--accent-30)] hover:text-[var(--accent-strong)] active:scale-[0.95] disabled:opacity-30"
      >
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 translate-x-px" />}
      </button>
      <div className="relative h-9 min-w-0 flex-1">
        <canvas ref={canvasRef} className="h-full w-full" />
        {effDuration !== null && (
          <span className="absolute bottom-0 right-0 rounded bg-[var(--panel)]/80 px-1 py-px text-[9px] font-mono text-[var(--text-45)]">
            {fmt(effDuration)}
          </span>
        )}
      </div>
    </div>
  );
}
