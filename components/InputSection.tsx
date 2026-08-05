'use client';

import { useState, useRef } from 'react';
import { ChevronRight, Clock, Loader2, Music, Play, Plus, Trash2, Upload, X } from 'lucide-react';
import { RawAudioFile, VideoInfo } from '../types/audio';
import { CARD, INPUT, LABEL, BTN_PRIMARY, BTN_GHOST, cleanSongTitle } from '../lib/ui';
import { useToast } from './Toast';

interface YoutubeLinkEntry {
  url: string;
  loading?: boolean;
  error?: string;
  video?: VideoInfo;
}

interface InputSectionProps {
  onFilesAdded: (files: RawAudioFile[]) => void;
  rawFilesCount?: number;
  backendUrl: string;
  youtubeCookies: string;
  onYoutubeCookiesChange: (cookies: string) => void;
  onNext?: () => void;
}

const YT_RE = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/;

export default function InputSection({ onFilesAdded, rawFilesCount = 0, backendUrl, youtubeCookies, onYoutubeCookiesChange, onNext }: InputSectionProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'file' | 'youtube'>('youtube');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeLinks, setYoutubeLinks] = useState<YoutubeLinkEntry[]>([]);
  const [converting, setConverting] = useState(false);
  const [cookieHelpUrl, setCookieHelpUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBotError = (message: string) =>
    /sign in to confirm|not a bot|confirm you'?re not a bot|unusual traffic|captcha|bot/i.test(message);

  const retryLink = (url: string) => {
    setYoutubeLinks((prev) =>
      prev.map((l) => (l.url === url ? { ...l, loading: true, error: undefined, video: undefined } : l))
    );
    fetchYoutubeInfo(url);
  };

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
      toast(`Berhasil mengambil info: ${cleanSongTitle(data.video.title)}`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengambil info video';
      if (isBotError(message)) {
        setCookieHelpUrl(candidate);
      }
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
  };

  const clearLinks = () => {
    setYoutubeLinks([]);
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
    toast(`Berhasil menambahkan ${rawFiles.length} file audio`, 'success');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onNext?.();
  };

  const handleYoutubeConvert = async () => {
    const targets = youtubeLinks.filter((l) => l.url && !l.error && l.video);
    if (targets.length === 0) return;

    setConverting(true);

    const results: RawAudioFile[] = [];
    const succeeded: string[] = [];

    const CONCURRENCY = 2;
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < targets.length) {
        const link = targets[nextIndex++];
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
            succeeded.push(link.url);
          } else {
            throw new Error(data.error || 'Download failed');
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Download failed';
          if (isBotError(message)) {
            setCookieHelpUrl(link.url);
          }
          setYoutubeLinks((prev) =>
            prev.map((l) => (l.url === link.url ? { ...l, error: message } : l))
          );
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

    if (results.length > 0) {
      onFilesAdded(results);
      toast(`Berhasil mengunduh ${results.length} audio ke MP3!`, 'success');
      const done = new Set(succeeded);
      setYoutubeLinks((prev) => prev.filter((l) => !done.has(l.url)));
      onNext?.();
    }

    setConverting(false);
  };

  const readyCount = youtubeLinks.filter((l) => l.video).length;
  const doneCount = rawFilesCount;

  return (
    <div className={CARD + ' p-4'}>
      <div className="flex items-center justify-between mb-4">
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
            className="w-full border-2 border-dashed border-[var(--line)] rounded-xl p-6 text-center transition hover:border-[var(--accent-30)] hover:bg-[var(--accent-06)]"
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
                        <p className="truncate text-sm font-medium text-[var(--text-90)]">{cleanSongTitle(link.video.title)}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-45)]">
                          <Clock className="w-3 h-3" />
                          {link.video.channel || 'YouTube'} · {link.video.durationString}
                        </p>
                      </div>
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
                        onClick={() => retryLink(link.url)}
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
            <div className="space-y-2">
              <p className="text-xs text-emerald-400/90">
                {doneCount} audio siap di-tune.
              </p>
              {onNext && (
                <button onClick={onNext} className={BTN_PRIMARY + ' w-full py-3'}>
                  Lanjut ke 2. Audio Tuning
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cookie Help Popup */}
      {cookieHelpUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setCookieHelpUrl(null)}
        >
          <div
            className="modal-enter w-full max-w-lg rounded-2xl border border-[var(--accent-25)] bg-[var(--panel)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-xl text-[var(--accent-strong)]">
                  Oops, kena &quot;not a bot&quot; bot check
                </h3>
                <p className="mt-1 text-xs text-[var(--text-40)]">
                  YouTube curiga kita robot. Tenang, gampang kok.
                </p>
              </div>
              <button
                onClick={() => setCookieHelpUrl(null)}
                className="p-1 text-[var(--text-40)] transition hover:text-[var(--text)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="mt-5 space-y-3">
              {[
                ['Install ekstensi', 'Buka Chrome/Edge → Chrome Web Store → cari "Get cookies.txt LOCALLY" → Add to Chrome. (Gratis)'],
                ['Login YouTube', 'Buka youtube.com lalu login pakai akun yang sama seperti biasa.'],
                ['Export cookies', 'Klik ikon ekstensi di pojok kanan atas → tombol "Export". File cookies.txt akan terdownload.'],
                ['Copy isinya', 'Buka file cookies.txt itu (pakai Notepad). Tekan Ctrl+A lalu Ctrl+C.'],
                ['Tempel di bawah', 'Klik kotak di bawah ini, tekan Ctrl+V, lalu klik tombol Simpan.'],
              ].map(([title, desc], i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--accent-30)] text-xs text-[var(--accent-soft)]">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-[var(--text-90)]">{title}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-[var(--text-50)]">{desc}</div>
                  </div>
                </li>
              ))}
            </ol>

            <textarea
              value={youtubeCookies}
              onChange={(e) => onYoutubeCookiesChange(e.target.value)}
              rows={5}
              placeholder="Tempel isi cookies.txt di sini..."
              className={INPUT + ' mt-5 resize-y font-mono text-xs'}
            />

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  const url = cookieHelpUrl;
                  setCookieHelpUrl(null);
                  retryLink(url);
                }}
                className={BTN_PRIMARY + ' flex-1'}
              >
                Simpan & Coba Lagi
              </button>
              <button onClick={() => setCookieHelpUrl(null)} className={BTN_GHOST}>
                Nanti saja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
