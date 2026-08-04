'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, AudioUpload } from '../lib/supabase';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const CORRECT_PIN = process.env.NEXT_PUBLIC_PIN || '515753';
const SETTINGS_KEY = 'audioUploader_settings';

type ToastType = 'info' | 'success' | 'error';
interface ToastMsg {
  id: number;
  message: string;
  type: ToastType;
}

interface VideoInfo {
  id: string;
  title: string;
  durationString: string;
  thumbnail: string;
  channel: string;
}

interface YoutubeLinkEntry {
  url: string;
  loading?: boolean;
  error?: string;
  video?: VideoInfo;
}

interface UploadFileEntry {
  file: File;
  video?: VideoInfo;
}

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const CARD = 'rounded-2xl border border-[var(--accent-15)] bg-gradient-to-br from-[var(--card-from)] via-[var(--card-via)] to-[var(--card-to)]';
const INPUT = 'w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-25)] outline-none transition-colors focus:border-[var(--accent-50)] focus:bg-[var(--surface-focus)]';
const LABEL = 'mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-40)]';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent-deep)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] transition-transform duration-150 active:scale-[0.97] hover:brightness-110 disabled:cursor-not-allowed disabled:from-[var(--surface-soft)] disabled:to-[var(--surface-soft)] disabled:text-[var(--text-40)] disabled:active:scale-100';
const BTN_GHOST = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--accent-25)] px-4 py-2 text-sm text-[var(--accent-soft-80)] transition-colors duration-150 hover:bg-[var(--accent-10)] hover:text-[var(--accent-strong)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50';

const THEMES: { id: string; label: string; swatch: string }[] = [
  { id: 'gold-dark', label: 'Gold Dark', swatch: 'linear-gradient(135deg, #f5d77f, #b8860b)' },
  { id: 'light', label: 'Light', swatch: 'linear-gradient(135deg, #ffffff, #e2e8f0)' },
  { id: 'crimson', label: 'Crimson', swatch: 'linear-gradient(135deg, #ef6a6a, #8b0f2b)' },
  { id: 'emerald', label: 'Emerald', swatch: 'linear-gradient(135deg, #6ee7b7, #047857)' },
  { id: 'royal', label: 'Royal', swatch: 'linear-gradient(135deg, #b5a3ff, #4c1d95)' },
  { id: 'ocean', label: 'Ocean', swatch: 'linear-gradient(135deg, #67e8f9, #0e7490)' },
  { id: 'sunset', label: 'Sunset', swatch: 'linear-gradient(135deg, #fda4af, #c2410c)' },
  { id: 'light-ocean', label: 'Light Ocean', swatch: 'linear-gradient(135deg, #dbeafe, #0284c7)' },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    Pending: 'border-[var(--accent-30)] bg-[var(--accent-10)] text-[var(--accent-strong)]',
    Copyright: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
    Failed: 'border-[var(--line)] bg-[var(--surface-soft)] text-[var(--text-50)]',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles[status] || styles.Failed}`}>
      {status}
    </span>
  );
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [files, setFiles] = useState<UploadFileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [targetType, setTargetType] = useState<'user' | 'group'>('user');
  const [userId, setUserId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [apiKeys, setApiKeys] = useState<string[]>(['']);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [youtubeCookies, setYoutubeCookies] = useState('');

  const [youtubeLinks, setYoutubeLinks] = useState<YoutubeLinkEntry[]>([]);
  const [youtubeLinkInput, setYoutubeLinkInput] = useState('');
  const [sourceTab, setSourceTab] = useState<'youtube' | 'file'>('youtube');
  const [speed, setSpeed] = useState(2.30);
  const [amplify, setAmplify] = useState(-4);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<any[]>([]);
  const [autoUpload, setAutoUpload] = useState(false);
  const [cookieHelpUrl, setCookieHelpUrl] = useState<string | null>(null);

  const [uploadHistory, setUploadHistory] = useState<AudioUpload[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, pending: 0, failed: 0, copyright: 0 });

  const [theme, setTheme] = useState<string>('gold-dark');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const downloadLockRef = useRef(false);
  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    const savedAuth = localStorage.getItem('audioUploader_auth');
    if (savedAuth === CORRECT_PIN) {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.apiKeys) && s.apiKeys.length > 0) setApiKeys(s.apiKeys);
        if (typeof s.userId === 'string') setUserId(s.userId);
        if (typeof s.groupId === 'string') setGroupId(s.groupId);
        if (s.targetType === 'user' || s.targetType === 'group') setTargetType(s.targetType);
        if (typeof s.speed === 'number') setSpeed(s.speed);
        if (typeof s.amplify === 'number') setAmplify(s.amplify);
        if (typeof s.youtubeCookies === 'string') setYoutubeCookies(s.youtubeCookies);
        if (typeof s.autoUpload === 'boolean') setAutoUpload(s.autoUpload);
        if (typeof s.theme === 'string') setTheme(s.theme);
      }
    } catch {
      // ignore corrupt saved settings
    }
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      apiKeys,
      userId,
      groupId,
      targetType,
      speed,
      amplify,
      youtubeCookies,
      autoUpload,
      theme,
    }));
  }, [settingsLoaded, apiKeys, userId, groupId, targetType, speed, amplify, youtubeCookies, autoUpload, theme]);

  useEffect(() => {
    if (isAuthenticated) {
      loadUploadHistory();
      const interval = setInterval(() => {
        loadUploadHistory();
        refreshPendingStatuses();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const loadUploadHistory = async () => {
    const { data, error } = await supabase
      .from('audio_uploads')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (!error && data) {
      setUploadHistory(data);
      const total = data.length;
      const active = data.filter(d => d.status === 'Active').length;
      const pending = data.filter(d => d.status === 'Pending').length;
      const failed = data.filter(d => d.status === 'Failed').length;
      const copyright = data.filter(d => d.status === 'Copyright').length;
      setSummary({ total, active, pending, failed, copyright });
    }
  };

  const saveToDatabase = async (assetId: string, name: string, status: string, youtubeUrl?: string) => {
    await supabase.from('audio_uploads').insert({
      asset_id: assetId,
      name: name,
      status: status,
      original_speed: speed,
      amplify: amplify,
      roblox_playback_speed: parseFloat(calculateRobloxPlaybackSpeed()),
      youtube_url: youtubeUrl || null,
      uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await loadUploadHistory();
  };

  const updateAssetStatus = async (assetId: string, status: string) => {
    await supabase
      .from('audio_uploads')
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq('asset_id', assetId);
    await loadUploadHistory();
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === CORRECT_PIN) {
      setIsAuthenticated(true);
      localStorage.setItem('audioUploader_auth', CORRECT_PIN);
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const calculateRobloxPlaybackSpeed = () => {
    return (1 / speed).toFixed(4);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
      ['audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/wav', 'audio/mp3'].includes(file.type) ||
      file.name.endsWith('.mp3') || file.name.endsWith('.ogg') || file.name.endsWith('.flac') || file.name.endsWith('.wav')
    );
    setFiles(prev => [...prev, ...droppedFiles.map(file => ({ file }))]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles.map(file => ({ file }))]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addApiKeyField = () => {
    setApiKeys(prev => [...prev, '']);
  };

  const updateApiKey = (index: number, value: string) => {
    setApiKeys(prev => prev.map((key, i) => i === index ? value : key));
  };

  const removeApiKeyField = (index: number) => {
    if (apiKeys.length > 1) {
      setApiKeys(prev => prev.filter((_, i) => i !== index));
    }
  };

  const fetchYoutubeInfo = async (candidate: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/youtube-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: candidate }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengambil info video');
      }
      setYoutubeLinks(prev =>
        prev.map(l => l.url === candidate ? { ...l, loading: false, video: data.video } : l)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengambil info video';
      if (/sign in to confirm|not a bot|confirm you'?re not a bot|unusual traffic|captcha/i.test(message)) {
        setCookieHelpUrl(candidate);
      }
      setYoutubeLinks(prev =>
        prev.map(l => l.url === candidate ? { ...l, loading: false, error: message } : l)
      );
    }
  };

  const addYoutubeLink = () => {
    const candidate = youtubeLinkInput.trim();
    if (!candidate) return;
    if (!/youtube\.com|youtu\.be/.test(candidate)) {
      addToast('Link harus dari YouTube', 'error');
      return;
    }
    if (youtubeLinks.some(l => l.url === candidate)) {
      addToast('Link sudah ada di daftar', 'error');
      return;
    }
    setYoutubeLinkInput('');
    setYoutubeLinks(prev => [...prev, { url: candidate, loading: true }]);
    fetchYoutubeInfo(candidate);
  };

  const removeYoutubeLink = (index: number) => {
    setYoutubeLinks(prev => prev.filter((_, i) => i !== index));
  };

  const handleYoutubeDownload = async () => {
    if (downloadLockRef.current) return;
    const urls = youtubeLinks.filter(l => l.url.trim());
    if (urls.length === 0) {
      addToast('Tambahkan minimal satu link YouTube dulu', 'error');
      return;
    }

    downloadLockRef.current = true;

    if (autoUpload) {
      const validApiKeys = apiKeys.filter(key => key.trim());
      if (validApiKeys.length === 0) {
        addToast('Auto-upload aktif tapi API Key belum diisi', 'error');
        return;
      }
      if (targetType === 'user' && !userId.trim()) {
        addToast('Auto-upload aktif tapi User ID belum diisi', 'error');
        return;
      }
      if (targetType === 'group' && !groupId.trim()) {
        addToast('Auto-upload aktif tapi Group ID belum diisi', 'error');
        return;
      }
    }

    setDownloading(true);
    setDownloadProgress(urls.map(({ url, video }) => ({ url, video, status: 'downloading', progress: 0 })));
    if (autoUpload) setResults([]);

    const processUrl = async (url: string, entry: YoutubeLinkEntry, index: number) => {
      try {
        if (autoUpload) {
          const apiKey = (apiKeys.filter(k => k.trim()))[index % apiKeys.filter(k => k.trim()).length];
          const response = await fetch(`${BACKEND_URL}/api/youtube-upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: url.trim(),
              speed,
              amplify,
              cookies: youtubeCookies,
              description: `Speed: ${speed}x | Amplify: ${amplify}dB | Roblox Playback: ${calculateRobloxPlaybackSpeed()}`,
              creatorType: targetType,
              creatorId: targetType === 'group' ? groupId : userId,
              apiKey,
            }),
          });

          const data = await response.json();

          if (response.ok && data.operationId) {
            let assetId: string | null = null;
            let status = 'Pending';
            let opError: string | null = null;

            for (let attempt = 0; attempt < 120; attempt += 1) {
              await new Promise((r) => setTimeout(r, 3000));
              const opResponse = await fetch(
                `${BACKEND_URL}/api/operation-status/${data.operationId}?apiKey=${encodeURIComponent(apiKey)}`
              );
              const opData = await opResponse.json();
              if (opData.done) {
                if (opData.assetId) {
                  assetId = opData.assetId;
                  status = opData.status || 'Pending';
                } else {
                  opError = opData.error || 'Upload failed during moderation';
                }
                break;
              }
            }

            if (assetId) {
              const name = data.filename || url;
              setResults(prev => [...prev, { filename: name, assetId, status, success: true }]);
              await saveToDatabase(assetId, name, status, url.trim());
            } else {
              setResults(prev => [...prev, { filename: url, error: opError || 'Upload is still processing after 6 minutes', success: false }]);
            }
          } else {
            setResults(prev => [...prev, { filename: url, error: data.error || data.message || 'Upload failed', success: false }]);
          }
        } else {
          const response = await fetch(`${BACKEND_URL}/api/youtube-download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url.trim(), speed, amplify, cookies: youtubeCookies }),
          });

          const data = await response.json();

          if (data.success) {
            const fileResponse = await fetch(`${BACKEND_URL}/api/download-file/${data.fileId}`);
            const blob = await fileResponse.blob();
            const file = new File([blob], data.filename, { type: 'audio/ogg' });
            setFiles(prev => [...prev, { file, video: entry.video }]);
          } else {
            throw new Error(data.error || 'Download failed');
          }
        }

        setDownloadProgress(prev =>
          prev.map(p => p.url === url ? { ...p, status: 'completed', progress: 100 } : p)
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Download failed';
        if (/sign in to confirm|not a bot|confirm you'?re not a bot|unusual traffic|captcha/i.test(message)) {
          setCookieHelpUrl(url);
        }
        setDownloadProgress(prev =>
          prev.map(p => p.url === url ? {
            ...p,
            status: 'failed',
            progress: 0,
            error: message,
          } : p)
        );
        if (autoUpload) {
          setResults(prev => [...prev, { filename: entry.url, error: message, success: false }]);
        }
      }
    };

    const CONCURRENCY = 2;
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < urls.length) {
        const index = nextIndex++;
        await processUrl(urls[index].url, urls[index], index);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));

    setDownloading(false);
    if (autoUpload) setYoutubeLinks([]);
    downloadLockRef.current = false;
  };

  const uploadToRoblox = async () => {
    if (files.length === 0) {
      addToast('Pilih file dulu, atau convert dari YouTube terlebih dahulu', 'error');
      return;
    }

    const validApiKeys = apiKeys.filter(key => key.trim());
    if (validApiKeys.length === 0) {
      addToast('Masukkan minimal satu API Key', 'error');
      return;
    }

    if (targetType === 'user' && !userId.trim()) {
      addToast('Masukkan User ID', 'error');
      return;
    }

    if (targetType === 'group' && !groupId.trim()) {
      addToast('Masukkan Group ID', 'error');
      return;
    }

    setUploading(true);
    setResults([]);

    const uploadResults: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i].file;
      const apiKey = validApiKeys[i % validApiKeys.length];

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('assetType', 'Audio');
        formData.append('displayName', file.name.replace(/\.[^/.]+$/, ''));
        formData.append('description', `Speed: ${speed}x | Amplify: ${amplify}dB | Roblox Playback: ${calculateRobloxPlaybackSpeed()}`);
        formData.append('creatorType', targetType);
        formData.append('creatorId', targetType === 'group' ? groupId : userId);
        formData.append('apiKey', apiKey);

        const response = await fetch(`${BACKEND_URL}/api/upload-to-roblox`, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (response.ok && result.operationId) {
          let assetId: string | null = null;
          let status = 'Pending';
          let opError: string | null = null;

          for (let attempt = 0; attempt < 120; attempt += 1) {
            await new Promise((r) => setTimeout(r, 3000));
            const opResponse = await fetch(
              `${BACKEND_URL}/api/operation-status/${result.operationId}?apiKey=${encodeURIComponent(apiKey)}`
            );
            const opData = await opResponse.json();

            if (opData.done) {
              if (opData.assetId) {
                assetId = opData.assetId;
                status = opData.status || 'Pending';
              } else {
                opError = opData.error || 'Upload failed during moderation';
              }
              break;
            }
          }

          if (assetId) {
            uploadResults.push({
              filename: file.name,
              assetId,
              status,
              success: true,
            });

            const youtubeUrl = youtubeLinks[i]?.url?.trim() || undefined;
            await saveToDatabase(assetId, file.name, status, youtubeUrl);
          } else {
            uploadResults.push({
              filename: file.name,
              error: opError || 'Upload is still processing after 6 minutes',
              success: false,
            });
          }
        } else {
          uploadResults.push({
            filename: file.name,
            error: result.error || result.message || 'Upload failed',
            success: false,
          });
        }
      } catch (error: any) {
        uploadResults.push({
          filename: file.name,
          error: error.message,
          success: false,
        });
      }
    }

    setResults(uploadResults);
    setUploading(false);
    setFiles([]);
    setYoutubeLinks([]);
  };

  const checkAssetStatus = async (assetId: string, apiKey: string): Promise<string> => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/asset-status/${assetId}?apiKey=${encodeURIComponent(apiKey)}`
      );

      const data = await response.json();

      if (data.moderationResult) {
        if (data.moderationResult.moderationState === 'Rejected') {
          return 'Copyright';
        }
      }

      if (data.status) return data.status;
      if (data.state === 'Active') return 'Active';
      if (data.state === 'Pending') return 'Pending';
      return 'Failed';
    } catch {
      return 'Pending';
    }
  };

  const refreshStatus = async (assetId: string) => {
    const validApiKey = apiKeys.find(key => key.trim());
    if (!validApiKey) return;

    const status = await checkAssetStatus(assetId, validApiKey);
    await updateAssetStatus(assetId, status);
  };

  const refreshPendingStatuses = async () => {
    const validApiKey = apiKeys.find(key => key.trim());
    if (!validApiKey) return;

    const { data } = await supabase
      .from('audio_uploads')
      .select('asset_id, status')
      .eq('status', 'Pending');

    if (!data || data.length === 0) return;

    for (const row of data) {
      const status = await checkAssetStatus(row.asset_id, validApiKey);
      if (status !== 'Pending' && status !== row.status) {
        await updateAssetStatus(row.asset_id, status);
      }
    }
  };

  const copyResults = () => {
    const text = results
      .filter(r => r.success)
      .map(r => `${r.filename}: ${r.assetId} (${r.status})`)
      .join('\n');
    navigator.clipboard.writeText(text);
    addToast('Hasil sudah disalin ke clipboard!', 'success');
  };

  const copyAssetId = async (assetId: string) => {
    await navigator.clipboard.writeText(assetId);
    addToast('Asset ID disalin!', 'success');
  };

  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] p-4 text-[var(--text)]">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[var(--glow-1)] blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-32 right-1/4 h-72 w-72 rounded-full bg-[var(--glow-3)] blur-[100px]" />

        <div className="relative w-full max-w-md">
          <div className="mb-10 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-[var(--accent-soft)]/70">S2 Studio</p>
            <h1 className="mt-4 bg-gradient-to-r from-[var(--accent-strong)] via-[var(--accent-soft)] to-[var(--accent-dark)] bg-clip-text font-serif text-5xl tracking-tight text-transparent">
              Audio Master <span className="italic">to</span> Roblox
            </h1>
          </div>

          <div className={`${CARD} modal-enter p-8`}>
            <form onSubmit={handlePinSubmit} className="space-y-5">
              <div>
                <label className={LABEL}>Access PIN</label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••••"
                  maxLength={6}
                  className={`${INPUT} text-center text-2xl tracking-[0.5em] ${pinError ? 'border-rose-400/40' : ''}`}
                  autoFocus
                />
                {pinError && (
                  <p className="toast-enter mt-2 text-center text-xs text-rose-300">Incorrect PIN</p>
                )}
              </div>

              <button type="submit" className={`${BTN_PRIMARY} w-full`}>
                Unlock
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-[11px] uppercase tracking-[0.3em] text-[var(--text-25)]">
            Created by <span className="text-[var(--text-50)]">fhrlsym</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-theme={theme} className="relative min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 right-[-8%] h-[34rem] w-[34rem] rounded-full bg-[var(--glow-1)] blur-[150px]" />
        <div className="absolute left-[-12%] top-1/3 h-[26rem] w-[26rem] rounded-full bg-[var(--glow-2)] blur-[130px]" />
        <div className="absolute bottom-[-18%] right-[-6%] h-[24rem] w-[24rem] rounded-full bg-[var(--glow-3)] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-8 md:px-6">
        <header className="relative overflow-hidden rounded-2xl border border-[var(--accent-15)] px-6 py-12 text-center md:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--accent-10),transparent_60%)] opacity-[var(--header-glow-opacity)]" />
          <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-[var(--accent-soft)]/70">S2 Studio</p>
          <h1 className="mt-4 bg-gradient-to-r from-[var(--accent-strong)] via-[var(--accent-soft)] to-[var(--accent-dark)] bg-clip-text font-serif text-5xl tracking-tight text-transparent md:text-6xl">
            Audio Master <span className="italic">to</span> Roblox
          </h1>
          <p className="mt-4 text-sm text-[var(--text-40)]">Convert · Tune · Upload · Track</p>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total', value: summary.total },
            { label: 'Active', value: summary.active },
            { label: 'Pending', value: summary.pending },
            { label: 'Copyright', value: summary.copyright },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[var(--accent-20)] bg-[var(--accent-03)] px-4 py-4 text-center">
              <div className="text-2xl font-semibold tabular-nums text-[var(--accent-strong)]">{stat.value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--text-35)]">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Settings & Controls Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 rounded-xl border border-[var(--accent-25)] px-4 py-2 text-sm text-[var(--accent-soft)]/80 transition-colors hover:bg-[var(--accent-10)] hover:text-[var(--accent-strong)] active:scale-[0.97]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
          <div className="relative">
            <button
              onClick={() => setShowThemePicker(v => !v)}
              className="flex items-center gap-2 rounded-xl border border-[var(--accent-25)] px-4 py-2 text-sm text-[var(--accent-soft)]/80 transition-colors hover:bg-[var(--accent-10)] hover:text-[var(--accent-strong)] active:scale-[0.97]"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent-dark)]" />
              {THEMES.find(t => t.id === theme)?.label || 'Tema'}
            </button>
            {showThemePicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowThemePicker(false)} />
                <div className="modal-enter absolute left-0 top-full z-50 mt-2 w-48 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-xl">
                  <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--text-35)]">Pilih Tema</p>
                  {THEMES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setTheme(t.id); setShowThemePicker(false); }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                        theme === t.id ? 'bg-[var(--accent-10)] text-[var(--accent-strong)]' : 'text-[var(--text-70)] hover:bg-[var(--surface-soft)]'
                      }`}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: t.swatch }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-[var(--text-40)]">
            <span>Speed: {speed}x</span>
            <span>·</span>
            <span>Amplify: {amplify}dB</span>
            <span>·</span>
            <span>Roblox: {calculateRobloxPlaybackSpeed()}</span>
          </div>
        </div>

        <main className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-6">
              {/* Input Audio */}
              <section className={`${CARD} p-6`}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--text-60)]">Input Audio</h3>
                  <button
                    onClick={() => setAutoUpload(v => !v)}
                    disabled={downloading}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 active:scale-95 ${
                      autoUpload
                        ? 'border-[var(--accent-50)] bg-[var(--accent-10)] text-[var(--accent-strong)]'
                        : 'border-[var(--line)] bg-[var(--surface-soft)] text-[var(--text-45)]'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${autoUpload ? 'bg-[var(--accent-strong)]' : 'bg-[var(--text-25)]'}`} />
                    Auto-upload {autoUpload ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Source Toggle */}
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--accent-20)] bg-[var(--surface)] p-1">
                  {(['youtube', 'file'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSourceTab(type)}
                      className={`rounded py-2 text-sm font-medium transition-all active:scale-95 ${
                        sourceTab === type
                          ? 'bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent-deep)] text-[var(--on-accent)]'
                          : 'text-[var(--text-50)] hover:text-[var(--text)]'
                      }`}
                    >
                      {type === 'youtube' ? 'Dari YouTube' : 'Upload File'}
                    </button>
                  ))}
                </div>

                {sourceTab === 'youtube' ? (
                  <>
                <div className="flex gap-2">
                  <input
                    value={youtubeLinkInput}
                    onChange={(e) => setYoutubeLinkInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addYoutubeLink(); } }}
                    placeholder="Paste link YouTube..."
                    className={`${INPUT} flex-1`}
                  />
                  <button onClick={addYoutubeLink} className={`${BTN_GHOST} shrink-0`}>
                    + Tambah
                  </button>
                </div>

                {youtubeLinks.length > 0 && (
                  <>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-[var(--text-40)]">{youtubeLinks.length} link</span>
                      <button
                        onClick={() => setYoutubeLinks([])}
                        disabled={downloading}
                        className="text-rose-300/80 transition-colors hover:text-rose-400 disabled:opacity-50"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                      {youtubeLinks.map((link, index) => (
                        <div key={link.url} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                          {link.loading ? (
                            <div className="flex w-full items-center gap-3">
                              <div className="h-12 w-20 shrink-0 animate-pulse rounded-lg bg-[var(--line)]" />
                              <div className="flex-1 space-y-2">
                                <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--line)]" />
                                <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--line)]" />
                              </div>
                            </div>
                          ) : link.error ? (
                            <div className="flex w-full items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-rose-300/90">{link.error}</p>
                                <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-40)]">{link.url}</p>
                              </div>
                              <button
                                onClick={() => removeYoutubeLink(index)}
                                className="shrink-0 text-xs text-[var(--text-50)] transition-colors hover:text-rose-300 active:scale-95"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              {link.video?.thumbnail && (
                                <img
                                  src={link.video.thumbnail}
                                  alt=""
                                  className="h-12 w-20 shrink-0 rounded-lg object-cover"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-[var(--text-90)]">{link.video?.title || link.url}</p>
                                <p className="mt-0.5 truncate text-xs text-[var(--text-45)]">
                                  {link.video ? `${link.video.channel} · ${link.video.durationString}` : link.url}
                                </p>
                              </div>
                              <button
                                onClick={() => removeYoutubeLink(index)}
                                disabled={downloading}
                                className="shrink-0 text-xs text-[var(--text-50)] transition-colors hover:text-rose-300 disabled:opacity-50"
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <button
                  onClick={handleYoutubeDownload}
                  disabled={downloading || youtubeLinks.length === 0}
                  className={`${BTN_PRIMARY} mt-4 w-full`}
                >
                  {downloading ? 'Memproses…' : (autoUpload ? 'Convert & Upload' : 'Convert ke OGG')}
                </button>

                {downloadProgress.length > 0 && (
                  <div className="mt-4 max-h-60 space-y-2 overflow-y-auto pr-1">
                    {downloadProgress.map((item, index) => (
                      <div key={index} className="stagger-enter flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs" style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          item.status === 'completed' ? 'bg-emerald-400' :
                          item.status === 'failed' ? 'bg-rose-400' : 'animate-pulse bg-[var(--accent-strong)]'
                        }`} />
                        <span className="min-w-0 flex-1 truncate text-[var(--text-70)]">{item.url}</span>
                        <span className={item.status === 'failed' ? 'text-rose-300/80' : 'text-[var(--text-40)]'}>
                          {item.status === 'completed' ? 'Selesai' : item.status === 'failed' ? 'Gagal' : 'Memproses…'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <details className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)]">
                  <summary className="cursor-pointer px-3 py-2 text-xs text-[var(--text-50)] transition-colors hover:text-[var(--text)]">
                    YouTube Cookies <span className="text-[var(--text-30)]">(opsional)</span>
                  </summary>
                  <div className="px-3 pb-3 pt-2">
                    <textarea
                      value={youtubeCookies}
                      onChange={(e) => setYoutubeCookies(e.target.value)}
                      rows={4}
                      placeholder="# Paste cookies.txt content here"
                      className={`${INPUT} resize-y font-mono text-xs`}
                    />
                    <p className="mt-2 text-xs leading-relaxed text-[var(--text-30)]">
                      Install extension &quot;Get cookies.txt LOCALLY&quot; → Export → paste di atas.
                    </p>
                  </div>
                </details>
                  </>
                ) : (
                  <>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => document.getElementById('fileInput')?.click()}
                  className="mt-4 cursor-pointer rounded-xl border border-dashed border-[var(--accent-25)] px-6 py-8 text-center transition-colors hover:border-[var(--accent-50)] hover:bg-[var(--accent-03)]"
                >
                  <p className="text-sm text-[var(--text-60)]">Seret file ke sini, atau klik untuk pilih</p>
                  <p className="mt-1 text-xs text-[var(--text-30)]">MP3 · OGG · FLAC · WAV</p>
                  <input
                    id="fileInput"
                    type="file"
                    multiple
                    accept="audio/*"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>

                {files.length > 0 && (
                  <>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-[var(--text-40)]">{files.length} file</span>
                      <button
                        onClick={() => setFiles([])}
                        className="text-rose-300/80 transition-colors hover:text-rose-400"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
                      {files.map((entry, index) => (
                        <div key={index} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                          {entry.video?.thumbnail ? (
                            <img
                              src={entry.video.thumbnail}
                              alt=""
                              className="h-12 w-20 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-20)] bg-[var(--accent-06)] text-lg">
                              ♪
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--text-90)]">
                              {entry.video?.title || entry.file.name.replace(/\.[^/.]+$/, '')}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[var(--text-45)]">
                              {entry.video ? `${entry.video.channel} · ${entry.video.durationString}` : entry.file.name}
                            </p>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="shrink-0 text-xs text-[var(--text-50)] transition-colors hover:text-rose-300"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                  </>
                )}
              </section>
          </div>

          <div className="space-y-6">
              {/* Roblox Config + Upload Button */}
              <section className={`${CARD} p-6`}>
                <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-60)]">Roblox Account</h3>
                
                <div className="space-y-4">
                  {/* User/Group Toggle */}
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--accent-20)] bg-[var(--surface)] p-1">
                    {(['user', 'group'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setTargetType(type)}
                        className={`rounded py-2 text-sm font-medium transition-all active:scale-95 ${
                          targetType === type
                            ? 'bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent-deep)] text-[var(--on-accent)]'
                            : 'text-[var(--text-50)] hover:text-[var(--text)]'
                        }`}
                      >
                        {type === 'user' ? 'User' : 'Group'}
                      </button>
                    ))}
                  </div>

                  {/* ID Input */}
                  <div>
                    <label className="mb-2 block text-xs text-[var(--text-40)]">{targetType === 'user' ? 'User ID' : 'Group ID'}</label>
                    <input
                      type="text"
                      value={targetType === 'user' ? userId : groupId}
                      onChange={(e) => targetType === 'user' ? setUserId(e.target.value) : setGroupId(e.target.value)}
                      placeholder={`Enter ${targetType === 'user' ? 'User' : 'Group'} ID`}
                      className={INPUT}
                    />
                  </div>

                  {/* API Keys */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs text-[var(--text-40)]">API Keys</label>
                      <button onClick={addApiKeyField} className="text-xs text-[var(--accent-soft)] transition-colors hover:text-[var(--accent-strong)]">
                        + Add key
                      </button>
                    </div>
                    <div className="space-y-2">
                      {apiKeys.map((key, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="password"
                            value={key}
                            onChange={(e) => updateApiKey(index, e.target.value)}
                            placeholder={`API Key ${index + 1}`}
                            className={INPUT}
                          />
                          {apiKeys.length > 1 && (
                            <button
                              onClick={() => removeApiKeyField(index)}
                              className="shrink-0 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text-50)] transition-colors hover:border-rose-400/30 hover:text-rose-300"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Upload Button */}
                <button
                  onClick={uploadToRoblox}
                  disabled={uploading || files.length === 0}
                  className="mt-6 w-full rounded-xl bg-gradient-to-r from-[var(--accent-strong)] via-[var(--accent-soft)] to-[var(--accent-deep)] py-4 text-base font-bold text-[var(--on-accent)] shadow-[0_0_30px_var(--upload-glow)] transition-transform duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-[var(--surface-soft)] disabled:via-[var(--surface-soft)] disabled:to-[var(--surface-soft)] disabled:text-[var(--text-40)] disabled:shadow-none disabled:active:scale-100"
                >
                  {uploading ? 'Mengupload…' : `Upload ke Roblox (${files.length})`}
                </button>
                <p className="mt-2 text-center text-xs text-[var(--text-35)]">
                  {files.length > 0
                    ? `${files.length} file → ${targetType} ${targetType === 'user' ? userId : groupId}`
                    : 'Belum ada file'}
                </p>
              </section>

              {/* Hasil */}
              <section className={`${CARD} p-6`}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--text-60)]">Hasil</h3>
                  {results.length > 0 && (
                    <button onClick={copyResults} className="text-xs text-[var(--accent-soft)]/80 transition-colors hover:text-[var(--accent-strong)]">
                      Salin
                    </button>
                  )}
                </div>

                {(downloadProgress.length === 0 && results.length === 0) ? (
                  <p className="py-8 text-center text-sm text-[var(--text-40)]">Belum ada hasil. Convert link atau upload file dulu.</p>
                ) : (
                  <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                    {downloadProgress.map((item, index) => (
                      <div key={index} className="stagger-enter flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs" style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          item.status === 'completed' ? 'bg-emerald-400' :
                          item.status === 'failed' ? 'bg-rose-400' : 'animate-pulse bg-[var(--accent-strong)]'
                        }`} />
                        <span className="min-w-0 flex-1 truncate text-[var(--text-70)]">
                          {item.video?.title || item.url}
                        </span>
                        <span className={item.status === 'failed' ? 'text-rose-300/80' : 'text-[var(--text-40)]'}>
                          {item.status === 'completed' ? 'Selesai' : item.status === 'failed' ? 'Gagal' : 'Memproses…'}
                        </span>
                      </div>
                    ))}
                    {results.map((result, index) => (
                      <div
                        key={index}
                        className={`stagger-enter rounded-lg border px-4 py-3 ${
                          result.success ? 'border-emerald-400/15 bg-emerald-400/[0.04]' : 'border-rose-400/15 bg-rose-400/[0.04]'
                        }`}
                        style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
                      >
                        {result.success ? (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)]">{result.filename}</div>
                              <StatusBadge status={result.status} />
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs">
                              <span className="text-[var(--text-40)]">ID:</span>
                              <span className="font-mono text-[var(--text-70)]">{result.assetId}</span>
                              <button
                                onClick={() => copyAssetId(result.assetId)}
                                className="ml-auto text-[var(--accent-soft)]/80 transition-colors hover:text-[var(--accent-strong)]"
                              >
                                Copy
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-[var(--text-90)]">{result.filename}</div>
                            <div className="mt-1 text-xs text-rose-300/80">{result.error}</div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
          </div>

          <section className={`${CARD} p-6 lg:col-span-2`}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--text-60)]">Riwayat Upload</h3>
                <button
                  onClick={() => loadUploadHistory()}
                  className="text-xs text-[var(--accent-soft)]/80 transition-colors hover:text-[var(--accent-strong)]"
                >
                  Refresh
                </button>
              </div>

              {uploadHistory.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--text-40)]">Belum ada history</p>
              ) : (
                <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                  {uploadHistory.map((item) => (
                    <div key={item.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-[var(--text-90)]">{item.name}</div>
                          <div className="mt-1 truncate font-mono text-xs text-[var(--text-45)]">{item.asset_id}</div>
                          {item.youtube_url && (
                            <div className="mt-1 truncate text-xs text-[var(--text-30)]">{item.youtube_url}</div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-35)]">
                            <span>Playback {item.roblox_playback_speed}</span>
                            <span>Speed {item.original_speed}x</span>
                            <span>Amplify {item.amplify}dB</span>
                          </div>
                          <div className="mt-1 text-xs text-[var(--text-25)]">{new Date(item.uploaded_at).toLocaleString()}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusBadge status={item.status} />
                          {item.status === 'Pending' && (
                            <button
                              onClick={() => refreshStatus(item.asset_id)}
                              className="rounded-lg border border-[var(--accent-25)] px-2 py-1 text-xs text-[var(--accent-soft)]/80 transition-colors hover:bg-[var(--accent-10)] hover:text-[var(--accent-strong)]"
                            >
                              Refresh
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </section>
        </main>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4" onClick={() => setShowSettings(false)}>
            <div className="modal-enter w-full max-w-md rounded-2xl border border-[var(--accent-25)] bg-[var(--panel)] p-6" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--accent-strong)]">Audio Settings</h3>
                <button onClick={() => setShowSettings(false)} className="text-[var(--text-40)] transition-colors hover:text-[var(--text)] active:scale-95">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs text-[var(--text-40)]">Speed (Playback)</label>
                    <span className="text-xs text-[var(--text-25)]">makin besar = cepat</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className={INPUT}
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs text-[var(--text-40)]">Amplify (dB)</label>
                    <span className="text-xs text-[var(--text-25)]">minus = pelan</span>
                  </div>
                  <input
                    type="number"
                    step="1"
                    value={amplify}
                    onChange={(e) => setAmplify(parseInt(e.target.value))}
                    className={INPUT}
                  />
                </div>

                <div className="rounded-lg border border-[var(--accent-25)] bg-gradient-to-br from-[var(--accent-10)] to-transparent px-4 py-3">
                  <div className="text-xs uppercase tracking-wider text-[var(--accent-soft)]/70">Roblox Playback</div>
                  <div className="mt-1 font-mono text-2xl tabular-nums text-[var(--accent-strong)]">{calculateRobloxPlaybackSpeed()}</div>
                </div>

                <button
                  onClick={() => { setSpeed(2.30); setAmplify(-4); }}
                  className="w-full rounded-lg border border-[var(--line)] py-2 text-xs text-[var(--text-50)] transition-colors hover:border-[var(--accent-30)] hover:text-[var(--accent-soft)] active:scale-95"
                >
                  Reset ke bawaan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cookie Help Popup */}
        {cookieHelpUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4" onClick={() => setCookieHelpUrl(null)}>
            <div className="modal-enter w-full max-w-lg rounded-2xl border border-[var(--accent-25)] bg-[var(--panel)] p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-serif text-xl text-[var(--accent-strong)]">Oops, kena &quot;not a bot&quot; 🤖</h3>
                  <p className="mt-1 text-xs text-[var(--text-40)]">YouTube curiga kita robot. Tenang, gampang kok.</p>
                </div>
                <button onClick={() => setCookieHelpUrl(null)} className="text-[var(--text-40)] transition-colors hover:text-[var(--text)] active:scale-95">✕</button>
              </div>

              <ol className="mt-5 space-y-3">
                {[
                  ['Install ekstensi', 'Buka Chrome/Edge → Chrome Web Store → cari &quot;Get cookies.txt LOCALLY&quot; → Add to Chrome. (Gratis)'],
                  ['Login YouTube', 'Buka youtube.com lalu login pakai akun yang sama seperti biasa.'],
                  ['Export cookies', 'Klik ikon ekstensi di pojok kanan atas → tombol "Export". File cookies.txt akan terdownload.'],
                  ['Copy isinya', 'Buka file cookies.txt itu (pakai Notepad). Tekan Ctrl+A lalu Ctrl+C.'],
                  ['Tempel di bawah', 'Klik kotak di bawah ini, tekan Ctrl+V, lalu klik tombol Simpan.'],
                ].map(([title, desc], i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--accent-30)] text-xs text-[var(--accent-soft)]">{i + 1}</span>
                    <div>
                      <div className="text-sm font-medium text-[var(--text-90)]">{title}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-[var(--text-50)]">{desc}</div>
                    </div>
                  </li>
                ))}
              </ol>

              <textarea
                value={youtubeCookies}
                onChange={(e) => setYoutubeCookies(e.target.value)}
                rows={5}
                placeholder="Tempel isi cookies.txt di sini..."
                className={`${INPUT} mt-5 resize-y font-mono text-xs`}
              />

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => {
                    setCookieHelpUrl(null);
                    setYoutubeLinks(prev => prev.some(l => l.url === cookieHelpUrl) ? prev : [...prev, { url: cookieHelpUrl, loading: true }]);
                    if (!youtubeLinks.some(l => l.url === cookieHelpUrl)) fetchYoutubeInfo(cookieHelpUrl);
                  }}
                  className={`${BTN_PRIMARY} flex-1`}
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

        <footer className="mt-12 flex flex-col items-center gap-1 border-t border-[var(--accent-10)] pt-8 text-center">
          <p className="font-serif text-lg italic text-[var(--accent-soft)]/70">S2 Studio — Audio Master to Roblox</p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-25)]">Created by fhrlsym</p>
        </footer>
      </div>

      {/* Toasts Container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast-enter flex min-w-[200px] items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${t.type === 'error' ? 'border-rose-400/20 bg-rose-400/20 text-rose-300' : t.type === 'success' ? 'border-emerald-400/20 bg-emerald-400/20 text-emerald-300' : 'border-[var(--line)] bg-[var(--panel)] text-[var(--text-90)]'}`}
          >
            <span className="text-sm font-medium">{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
