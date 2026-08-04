'use client';

import { useState, useRef } from 'react';
import { Check, Clock, Loader2, Music, Play, Plus, Trash2, Upload } from 'lucide-react';
import { RawAudioFile, VideoInfo } from '../types/audio';
import { CARD, INPUT, LABEL, BTN_PRIMARY, BTN_GHOST } from '../lib/ui';

interface YoutubeLinkEntry {
  url: string;
  loading?: boolean;
  error?: string;
  video?: VideoInfo;
}

interface InputSectionProps {
  onFilesAdded: (files: RawAudioFile[]) => void;
  backendUrl: string;
  youtubeCookies: string;
}

const YT_RE = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/;

export default function InputSection({ onFilesAdded, backendUrl, youtubeCookies }: InputSectionProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'youtube'>('youtube');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeLinks, setYoutubeLinks] = useState<YoutubeLinkEntry[]>([]);
  const [converting, setConverting] = useState(false);
  const [converted, setConverted] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchYoutubeInfo = async (candidate: string) => {
    try {
      const response = await fetch(`${backendUrl}/api/youtube-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: candidate, cookies: youtubeCookies }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengambil info video');
      }
      setYoutubeLinks((prev) =>
        prev.map((l) => (l.url === candidate ? { ...l, loading: false, video: data.video } : l))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengambil info video';
      setYoutubeLinks((prev) =>
        prev.map((l) => (l.url === candidate ? { ...l, loading: false, error: message } : l))
      );
    }
  };

  const addLink = (rawUrl: string) => {
    const url = rawUrl.trim();
    if (!url) return;
    if (!YT_RE.test(url)) {
      setYoutubeLinks((prev) => {
        if (prev.some((l) => l.url === url)) return prev;
        return [...prev, { url, error: 'URL YouTube tidak valid' }];
      });
      return;
    }
    setYoutubeLinks((prev) => {
      if (prev.some((l) => l.url === url)) return prev;
      return [...prev, { url, loading: true }];
    });
    fetchYoutubeInfo(url);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLink(youtubeInput);
      setYoutubeInput('');
    }
  };

  const removeLink = (url: string) => {
    setYoutubeLinks((prev) => prev.filter((l) => l.url !== url));
    setConverted((prev) => {
      const next = { ...prev };
      delete next[url];
      return next;
    });
  };

  const clearLinks = () => {
    setYoutubeLinks([]);
    setConverted({});
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const rawFiles: RawAudioFile[] = Array.from(files).map((file) => ({
      id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: file.name,
      file,
      size: file.size,
    }));

    onFilesAdded(rawFiles);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleYoutubeConvert = async () => {
    const targets = youtubeLinks.filter((l) => l.url && !l.error && l.video);
    if (targets.length === 0) return;

    setConverting(true);

    const results: RawAudioFile[] = [];

    for (const link of targets) {
      try {
        const response = await fetch(`${backendUrl}/api/youtube-download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: link.url, speed: 1.0, amplify: 0, cookies: youtubeCookies }),
        });

        const data = await response.json();

        if (data.success) {
          results.push({
            id: `yt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            name: data.filename,
            fileId: data.fileId,
            url: link.url,
            video: link.video,
          });
          setConverted((prev) => ({ ...prev, [link.url]: true }));
        } else {
          throw new Error(data.error || 'Download failed');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Download failed';
        setYoutubeLinks((prev) =>
          prev.map((l) => (l.url === link.url ? { ...l, error: message } : l))
        );
      }
    }

    if (results.length > 0) {
      onFilesAdded(results);
    }

    setConverting(false);
  };

  const readyCount = youtubeLinks.filter((l) => l.video).length;
  const doneCount = Object.keys(converted).filter((u) => youtubeLinks.some((l) => l.url === u)).length;

  return (
    <div className={CARD + ' p-6'}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-[var(--text)] tracking-tight">1. Input Audio</h2>
        <div className="flex gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
          <button
            onClick={() => setActiveTab('file')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'file'
                ? 'bg-[var(--accent-20)] text-[var(--accent-strong)]'
                : 'text-[var(--text-50)] hover:text-[var(--text-80)]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            File
          </button>
          <button
            onClick={() => setActiveTab('youtube')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'youtube'
                ? 'bg-[var(--accent-20)] text-[var(--accent-strong)]'
                : 'text-[var(--text-50)] hover:text-[var(--text-80)]'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            YouTube
          </button>
        </div>
      </div>

      {activeTab === 'file' ? (
        <div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-[var(--line)] rounded-xl p-10 text-center transition hover:border-[var(--accent-30)] hover:bg-[var(--accent-06)]"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)]">
              <Upload className="w-5 h-5 text-[var(--text-50)]" />
            </div>
            <p className="text-sm font-medium text-[var(--text-80)]">Klik untuk pilih audio</p>
            <p className="text-xs text-[var(--text-40)] mt-1">MP3 · WAV · OGG · M4A — multi file didukung</p>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={youtubeInput}
              onChange={(e) => setYoutubeInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Tempel link YouTube lalu Enter…"
              className={INPUT}
            />
            <button
              onClick={() => {
                addLink(youtubeInput);
                setYoutubeInput('');
              }}
              className={BTN_GHOST + ' shrink-0 px-3'}
              title="Tambah link"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {youtubeLinks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className={LABEL}>Antrian ({readyCount} siap)</p>
                <button onClick={clearLinks} className="text-[11px] text-[var(--text-40)] hover:text-rose-300 transition">
                  Hapus semua
                </button>
              </div>
              {youtubeLinks.map((link) => (
                <div
                  key={link.url}
                  className={`flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 transition ${
                    link.error ? 'border-rose-400/25' : 'hover:border-[var(--accent-25)]'
                  }`}
                >
                  {link.loading ? (
                    <>
                      <div className="h-12 w-20 shrink-0 animate-pulse rounded-lg bg-[var(--surface-strong)]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--surface-strong)]" />
                        <div className="h-2.5 w-1/3 animate-pulse rounded bg-[var(--surface-strong)]" />
                      </div>
                      <Loader2 className="w-4 h-4 shrink-0 animate-spin text-[var(--accent-soft)]" />
                    </>
                  ) : link.video ? (
                    <>
                      {link.video.thumbnail ? (
                        <img
                          src={link.video.thumbnail}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-12 w-20 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]">
                          <Music className="w-5 h-5 text-[var(--text-40)]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--text-90)]">{link.video.title}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-45)]">
                          <Clock className="w-3 h-3" />
                          {link.video.channel || 'YouTube'} · {link.video.durationString}
                        </p>
                      </div>
                      {converted[link.url] ? (
                        <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                      ) : null}
                      <button
                        onClick={() => removeLink(link.url)}
                        className="shrink-0 p-1.5 text-[var(--text-40)] transition hover:text-rose-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg border border-rose-400/25 bg-rose-400/5">
                        <Play className="w-5 h-5 text-rose-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-[var(--text-60)]">{link.url}</p>
                        <p className="mt-0.5 text-xs text-rose-300">{link.error}</p>
                      </div>
                      <button
                        onClick={() => {
                          setYoutubeLinks((prev) =>
                            prev.map((l) => (l.url === link.url ? { ...l, loading: true, error: undefined } : l))
                          );
                          fetchYoutubeInfo(link.url);
                        }}
                        className="shrink-0 text-[11px] text-[var(--accent-soft)] hover:text-[var(--accent-strong)] transition"
                      >
                        Coba lagi
                      </button>
                      <button
                        onClick={() => removeLink(link.url)}
                        className="shrink-0 p-1.5 text-[var(--text-40)] transition hover:text-rose-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleYoutubeConvert}
            disabled={converting || readyCount === 0}
            className={BTN_PRIMARY + ' w-full py-3'}
          >
            {converting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mengunduh…
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Unduh ke MP3 ({readyCount})
              </>
            )}
          </button>

          {doneCount > 0 && (
            <p className="text-xs text-emerald-400/90">
              {doneCount} audio siap di-tune di bagian berikutnya.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
