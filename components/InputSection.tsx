'use client';

import { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Clock, Headphones, Loader2, Music, Play, Plus, Trash2, Upload, X } from 'lucide-react';
import { RawAudioFile, VideoInfo } from '../types/audio';
import { CARD, INPUT, LABEL, BTN_PRIMARY, BTN_GHOST, cleanSongTitle } from '../lib/ui';
import { useToast } from './Toast';

interface YoutubeLinkEntry {
  url: string;
  loading?: boolean;
  error?: string;
  video?: VideoInfo;
}

class YoutubeRequestError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
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
  const [activeTab, setActiveTab] = useState<'file' | 'youtube' | 'soundcloud'>('youtube');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeLinks, setYoutubeLinks] = useState<YoutubeLinkEntry[]>([]);
  const [soundcloudInput, setSoundcloudInput] = useState('');
  const [soundcloudLinks, setSoundcloudLinks] = useState<YoutubeLinkEntry[]>([]);
  const [converting, setConverting] = useState(false);
  const [cookieHelpUrl, setCookieHelpUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shouldRequestCookies = (error: unknown) => {
    if (error instanceof YoutubeRequestError) {
      return error.code === 'YOUTUBE_AUTH_REQUIRED' || error.code === 'YOUTUBE_COOKIES_EXPIRED';
    }
    const message = error instanceof Error ? error.message : '';
    return !youtubeCookies.trim() && /sign in to confirm|not a bot|unusual traffic|captcha/i.test(message);
  };

  const isServerNetworkError = (error: unknown) =>
    error instanceof YoutubeRequestError &&
    ['YOUTUBE_ACCESS_BLOCKED'].includes(error.code || '');

  const retryLink = (url: string) => {
    setYoutubeLinks((prev) =>
      prev.map((l) => (l.url === url ? { ...l, loading: true, error: undefined, video: undefined } : l))
    );
    return fetchYoutubeInfo(url);
  };

  const fetchYoutubeInfo = async (candidate: string): Promise<VideoInfo | undefined> => {
    try {
      const response = await fetch(`${backendUrl}/api/youtube-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: candidate, cookies: youtubeCookies }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new YoutubeRequestError(data.error || 'Gagal mengambil info video', data.code);
      }
      setYoutubeLinks((prev) =>
        prev.map((l) => (l.url === candidate ? { ...l, loading: false, video: data.video } : l))
      );
      toast(`Berhasil mengambil info: ${cleanSongTitle(data.video.title)}`, 'success');
      return data.video as VideoInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengambil info video';
      if (shouldRequestCookies(error)) setCookieHelpUrl(candidate);
      if (isServerNetworkError(error)) toast(message, 'error');
      setYoutubeLinks((prev) =>
        prev.map((l) => (l.url === candidate ? { ...l, loading: false, error: message } : l))
      );
      return undefined;
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

  const downloadTargets = async (targets: YoutubeLinkEntry[]) => {
    if (targets.length === 0) return;

    setConverting(true);

    const results: RawAudioFile[] = [];
    const succeeded: string[] = [];
    let networkErrorShown = false;

    const CONCURRENCY = 1;
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
            throw new YoutubeRequestError(data.error || 'Download failed', data.code);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Download failed';
          if (shouldRequestCookies(error)) setCookieHelpUrl(link.url);
          if (isServerNetworkError(error) && !networkErrorShown) {
            networkErrorShown = true;
            toast(message, 'error');
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

  const handleYoutubeConvert = () => {
    const targets = youtubeLinks.filter((l) => l.url && !l.error && l.video);
    return downloadTargets(targets);
  };

  const isSoundCloudUrl = (value: string) => {
    try {
      const hostname = new URL(value).hostname.toLowerCase();
      return hostname === 'soundcloud.com' || hostname.endsWith('.soundcloud.com') || hostname === 'on.soundcloud.com';
    } catch {
      return false;
    }
  };

  const fetchSoundCloudInfo = async (url: string): Promise<VideoInfo | undefined> => {
    try {
      const response = await fetch(`${backendUrl}/api/soundcloud-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Gagal mengambil info SoundCloud');
      setSoundcloudLinks((prev) => prev.map((link) => link.url === url ? { ...link, loading: false, video: data.audio, error: undefined } : link));
      toast(`Berhasil mengambil info: ${cleanSongTitle(data.audio.title)}`, 'success');
      return data.audio as VideoInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengambil info SoundCloud';
      setSoundcloudLinks((prev) => prev.map((link) => link.url === url ? { ...link, loading: false, error: message, video: undefined } : link));
      return undefined;
    }
  };

  const addSoundCloudLink = (rawUrl: string) => {
    const url = rawUrl.trim();
    if (!url) return;
    if (!isSoundCloudUrl(url)) {
      setSoundcloudLinks((prev) => prev.some((link) => link.url === url) ? prev : [...prev, { url, error: 'URL SoundCloud tidak valid' }]);
      return;
    }
    setSoundcloudLinks((prev) => prev.some((link) => link.url === url) ? prev : [...prev, { url, loading: true }]);
    fetchSoundCloudInfo(url);
  };

  const retrySoundCloudLink = (url: string) => {
    setSoundcloudLinks((prev) => prev.map((link) => link.url === url ? { ...link, loading: true, error: undefined } : link));
    return fetchSoundCloudInfo(url);
  };

  const downloadSoundCloudTargets = async (targets: YoutubeLinkEntry[]) => {
    if (targets.length === 0) return;
    setConverting(true);
    const results: RawAudioFile[] = [];
    const succeeded = new Set<string>();

    for (const link of targets) {
      try {
        const response = await fetch(`${backendUrl}/api/soundcloud-download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: link.url }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Download SoundCloud gagal');
        results.push({
          id: `sc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: data.filename,
          fileId: data.fileId,
          url: link.url,
          video: link.video,
        });
        succeeded.add(link.url);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Download SoundCloud gagal';
        setSoundcloudLinks((prev) => prev.map((item) => item.url === link.url ? { ...item, error: message } : item));
      }
    }

    if (results.length > 0) {
      onFilesAdded(results);
      setSoundcloudLinks((prev) => prev.filter((link) => !succeeded.has(link.url)));
      toast(`Berhasil mengunduh ${results.length} audio SoundCloud!`, 'success');
      onNext?.();
    }
    setConverting(false);
  };

  const readyCount = youtubeLinks.filter((l) => l.video).length;
  const soundcloudReadyCount = soundcloudLinks.filter((link) => link.video).length;
  const doneCount = rawFilesCount;

  return (
    <div className={CARD + ' p-4'}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-[var(--text)] tracking-tight">1. Input Audio</h2>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5 sm:flex">
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
            className={`flex items-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'youtube'
                ? 'bg-[var(--accent-20)] text-[var(--accent-strong)]'
                : 'text-[var(--text-50)] hover:text-[var(--text-80)]'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            YouTube
          </button>
          <button
            onClick={() => setActiveTab('soundcloud')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'soundcloud'
                ? 'bg-[var(--accent-20)] text-[var(--accent-strong)]'
                : 'text-[var(--text-50)] hover:text-[var(--text-80)]'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SoundCloud</span>
            <span className="sm:hidden">SC</span>
          </button>
        </div>
      </div>

      {activeTab === 'file' ? (
        <div>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const files = e.dataTransfer.files;
              if (!files || files.length === 0) return;

              const dropped: RawAudioFile[] = Array.from(files).map((file) => ({
                id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                name: file.name,
                file,
                size: file.size,
              }));

              onFilesAdded(dropped);
              toast(`Berhasil menambahkan ${dropped.length} file audio`, 'success');
              onNext?.();
            }}
            className={`cursor-pointer w-full border-2 border-dashed rounded-2xl p-5 sm:p-8 text-center transition-all ${
              isDragging
                ? 'border-[var(--accent)] bg-[var(--accent-15)] scale-[1.01] shadow-xl'
                : 'border-[var(--line)] bg-[var(--surface-50)] hover:border-[var(--accent-30)] hover:bg-[var(--surface)]'
            }`}
          >
            <div className="mx-auto mb-3 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--accent-soft)] shadow-sm">
              <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-[var(--text-90)]">
              {isDragging ? 'Lepaskan file di sini' : 'Klik atau tarik (drag & drop) file audio ke sini'}
            </p>
            <p className="text-[11px] sm:text-xs text-[var(--text-40)] mt-1.5 font-medium">MP3 · WAV · OGG · M4A — multi file didukung</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      ) : activeTab === 'youtube' ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="url"
              value={youtubeInput}
              onChange={(e) => setYoutubeInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Tempel link YouTube lalu Enter…"
              className={INPUT + ' text-xs sm:text-sm'}
            />
            <button
              onClick={() => {
                addLink(youtubeInput);
                setYoutubeInput('');
              }}
              className={BTN_GHOST + ' shrink-0 px-3'}
              aria-label="Tambah link YouTube"
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
              <AnimatePresence>
                {youtubeLinks.map((link, index) => (
                  <motion.div
                    key={link.url}
                    initial={{ opacity: 0, height: 0, y: 6 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -6 }}
                    transition={{ duration: 0.2, delay: index * 0.04 }}
                    className={`flex items-center gap-2.5 sm:gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 sm:p-2.5 transition ${
                      link.error ? 'border-rose-400/25' : 'hover:border-[var(--accent-25)]'
                    }`}
                  >
                    {link.loading ? (
                      <>
                        <div className="h-10 w-14 sm:h-12 sm:w-20 shrink-0 animate-pulse rounded-lg bg-[var(--surface-strong)]" />
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
                            className="h-10 w-14 sm:h-12 sm:w-20 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-14 sm:h-12 sm:w-20 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]">
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
                  </motion.div>
                ))}
              </AnimatePresence>
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
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="url"
              value={soundcloudInput}
              onChange={(event) => setSoundcloudInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addSoundCloudLink(soundcloudInput);
                  setSoundcloudInput('');
                }
              }}
              placeholder="Tempel link track SoundCloud lalu Enter…"
              className={INPUT + ' text-xs sm:text-sm'}
            />
            <button
              type="button"
              onClick={() => {
                addSoundCloudLink(soundcloudInput);
                setSoundcloudInput('');
              }}
              className={BTN_GHOST + ' shrink-0 px-3'}
              aria-label="Tambah link SoundCloud"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {soundcloudLinks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className={LABEL}>Antrian SoundCloud ({soundcloudReadyCount} siap)</p>
                <button onClick={() => setSoundcloudLinks([])} className="text-[11px] text-[var(--text-40)] transition hover:text-rose-300">
                  Hapus semua
                </button>
              </div>
              <AnimatePresence>
                {soundcloudLinks.map((link, index) => (
                  <motion.div
                    key={link.url}
                    initial={{ opacity: 0, height: 0, y: 6 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -6 }}
                    transition={{ duration: 0.2, delay: index * 0.04 }}
                    className={`flex items-center gap-2.5 rounded-xl border bg-[var(--surface)] p-2.5 ${link.error ? 'border-rose-400/25' : 'border-[var(--line)]'}`}
                  >
                    {link.loading ? (
                      <>
                        <div className="h-12 w-20 shrink-0 animate-pulse rounded-lg bg-[var(--surface-strong)]" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--surface-strong)]" />
                          <div className="h-2.5 w-1/3 animate-pulse rounded bg-[var(--surface-strong)]" />
                        </div>
                        <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-soft)]" />
                      </>
                    ) : link.video ? (
                      <>
                        {link.video.thumbnail ? (
                          <img src={link.video.thumbnail} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-strong)]">
                            <Headphones className="w-5 h-5 text-[var(--text-40)]" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--text-90)]">{cleanSongTitle(link.video.title)}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-45)]">
                            <Clock className="w-3 h-3" />
                            {link.video.channel || 'SoundCloud'} · {link.video.durationString}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-[var(--text-60)]">{link.url}</p>
                        <p className="mt-0.5 text-xs text-rose-300">{link.error}</p>
                      </div>
                    )}
                    {link.error && (
                      <button onClick={() => retrySoundCloudLink(link.url)} className="shrink-0 text-[11px] text-[var(--accent-soft)]">Coba lagi</button>
                    )}
                    <button onClick={() => setSoundcloudLinks((prev) => prev.filter((item) => item.url !== link.url))} className="shrink-0 p-1.5 text-[var(--text-40)] hover:text-rose-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          <button
            type="button"
            onClick={() => downloadSoundCloudTargets(soundcloudLinks.filter((link) => link.video && !link.error))}
            disabled={converting || soundcloudReadyCount === 0}
            className={BTN_PRIMARY + ' w-full py-3'}
          >
            {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Headphones className="w-4 h-4" />}
            {converting ? 'Mengunduh…' : `Unduh SoundCloud (${soundcloudReadyCount})`}
          </button>

          {doneCount > 0 && onNext && (
            <button onClick={onNext} className={BTN_PRIMARY + ' w-full py-3'}>
              Lanjut ke 2. Audio Tuning
              <ChevronRight className="w-4 h-4" />
            </button>
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
                onClick={async () => {
                  const targetUrl = cookieHelpUrl;
                  setCookieHelpUrl(null);
                  // Retry every failed link (including the one that triggered the modal)
                  const urls: string[] = [];
                  if (targetUrl) urls.push(targetUrl);
                  youtubeLinks.forEach((l) => {
                    if (l.error && l.url !== targetUrl) urls.push(l.url);
                  });
                  const videos = await Promise.all(urls.map((u) => retryLink(u)));
                  const ready = urls
                    .map((u, i) => ({ url: u, video: videos[i] }))
                    .filter((t): t is { url: string; video: VideoInfo } => !!t.video);
                  if (ready.length > 0) {
                    await downloadTargets(ready);
                  }
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
