'use client';

import { useState, useEffect } from 'react';
import { supabase, AudioUpload } from '../lib/supabase';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const CORRECT_PIN = '515753';
const SETTINGS_KEY = 'audioUploader_settings';

const CARD = 'rounded-2xl border border-[#d4af37]/15 bg-gradient-to-br from-white/[0.035] via-white/[0.015] to-black/30';
const INPUT = 'w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none transition focus:border-[#d4af37]/50 focus:bg-black/70';
const LABEL = 'mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-white/40';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f5d06f] to-[#c9a227] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-white/10 disabled:to-white/10 disabled:text-white/40';
const BTN_GHOST = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#d4af37]/25 px-4 py-2 text-sm text-[#e6c15c]/80 transition hover:bg-[#d4af37]/10 hover:text-[#f5d06f] disabled:cursor-not-allowed disabled:opacity-50';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    Pending: 'border-[#d4af37]/30 bg-[#d4af37]/10 text-[#f5d06f]',
    Copyright: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
    Failed: 'border-white/10 bg-white/5 text-white/50',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles[status] || styles.Failed}`}>
      {status}
    </span>
  );
}

function SectionHeader({ num, title, right, hint }: { num: string; title: string; right?: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d4af37]/30 bg-[#d4af37]/[0.06] font-serif text-sm text-[#e6c15c]">
          {num}
        </span>
        <h2 className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/45">{title}</h2>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {hint && <p className="mt-3 pl-[3.25rem] text-xs leading-relaxed text-white/35">{hint}</p>}
    </div>
  );
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [targetType, setTargetType] = useState<'user' | 'group'>('user');
  const [userId, setUserId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [apiKeys, setApiKeys] = useState<string[]>(['']);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [youtubeCookies, setYoutubeCookies] = useState('');

  const [youtubeLinks, setYoutubeLinks] = useState<string[]>([]);
  const [youtubeLinkInput, setYoutubeLinkInput] = useState('');
  const [speed, setSpeed] = useState(2.30);
  const [amplify, setAmplify] = useState(-4);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<any[]>([]);
  const [autoUpload, setAutoUpload] = useState(false);
  const [cookieHelpUrl, setCookieHelpUrl] = useState<string | null>(null);

  const [uploadHistory, setUploadHistory] = useState<AudioUpload[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [summary, setSummary] = useState({ total: 0, active: 0, pending: 0, failed: 0, copyright: 0 });

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
    }));
  }, [settingsLoaded, apiKeys, userId, groupId, targetType, speed, amplify, youtubeCookies, autoUpload]);

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
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
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

  const addYoutubeLink = () => {
    const candidate = youtubeLinkInput.trim();
    if (!candidate) return;
    if (!youtubeLinks.some(l => l === candidate)) {
      setYoutubeLinks(prev => [...prev, candidate]);
    }
    setYoutubeLinkInput('');
  };

  const removeYoutubeLink = (index: number) => {
    setYoutubeLinks(prev => prev.filter((_, i) => i !== index));
  };

  const handleYoutubeDownload = async () => {
    const urls = youtubeLinks.filter(url => url.trim());
    if (urls.length === 0) {
      alert('Tambahkan minimal satu link YouTube dulu');
      return;
    }

    if (autoUpload) {
      const validApiKeys = apiKeys.filter(key => key.trim());
      if (validApiKeys.length === 0) {
        alert('Auto-upload aktif tapi API Key belum diisi');
        return;
      }
      if (targetType === 'user' && !userId.trim()) {
        alert('Auto-upload aktif tapi User ID belum diisi');
        return;
      }
      if (targetType === 'group' && !groupId.trim()) {
        alert('Auto-upload aktif tapi Group ID belum diisi');
        return;
      }
    }

    setDownloading(true);
    setDownloadProgress(urls.map(url => ({ url, status: 'downloading', progress: 0 })));
    if (autoUpload) setResults([]);

    const processUrl = async (url: string, index: number) => {
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
            const file = new File([blob], data.filename, { type: 'audio/mpeg' });
            setFiles(prev => [...prev, file]);
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
          setResults(prev => [...prev, { filename: url, error: message, success: false }]);
        }
      }
    };

    const CONCURRENCY = 2;
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < urls.length) {
        const index = nextIndex++;
        await processUrl(urls[index], index);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));

    setDownloading(false);
    if (autoUpload) setYoutubeLinks([]);
  };

  const uploadToRoblox = async () => {
    if (files.length === 0) {
      alert('Pilih file dulu, atau convert dari YouTube terlebih dahulu');
      return;
    }

    const validApiKeys = apiKeys.filter(key => key.trim());
    if (validApiKeys.length === 0) {
      alert('Masukkan minimal satu API Key');
      return;
    }

    if (targetType === 'user' && !userId.trim()) {
      alert('Masukkan User ID');
      return;
    }

    if (targetType === 'group' && !groupId.trim()) {
      alert('Masukkan Group ID');
      return;
    }

    setUploading(true);
    setResults([]);

    const uploadResults: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
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

            const youtubeUrl = youtubeLinks[i]?.trim() || undefined;
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
    alert('Hasil sudah disalin ke clipboard!');
  };

  const copyAssetId = async (assetId: string) => {
    await navigator.clipboard.writeText(assetId);
    alert('Asset ID disalin!');
  };

  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08080a] p-4 text-white">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#d4af37]/[0.08] blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-32 right-1/4 h-72 w-72 rounded-full bg-white/[0.04] blur-[100px]" />

        <div className="relative w-full max-w-md">
          <div className="mb-10 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-[#e6c15c]/70">S2 Studio</p>
            <h1 className="mt-4 bg-gradient-to-r from-[#f5d06f] via-[#e6c15c] to-[#b8860b] bg-clip-text font-serif text-5xl tracking-tight text-transparent">
              Audio Master <span className="italic">to</span> Roblox
            </h1>
          </div>

          <div className={`${CARD} p-8`}>
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
                  <p className="mt-2 text-center text-xs text-rose-300">Incorrect PIN</p>
                )}
              </div>

              <button type="submit" className={`${BTN_PRIMARY} w-full`}>
                Unlock
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-[11px] uppercase tracking-[0.3em] text-white/25">
            Created by <span className="text-white/50">fhrlsym</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#08080a] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 right-[-8%] h-[34rem] w-[34rem] rounded-full bg-[#d4af37]/[0.07] blur-[150px]" />
        <div className="absolute left-[-12%] top-1/3 h-[26rem] w-[26rem] rounded-full bg-[#7a5c1f]/[0.12] blur-[130px]" />
        <div className="absolute bottom-[-18%] right-[-6%] h-[24rem] w-[24rem] rounded-full bg-white/[0.03] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-8 md:px-6">
        <header className="relative overflow-hidden rounded-2xl border border-[#d4af37]/15 px-6 py-12 text-center md:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.09),transparent_60%)]" />
          <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-[#e6c15c]/70">S2 Studio</p>
          <h1 className="mt-4 bg-gradient-to-r from-[#f5d06f] via-[#e6c15c] to-[#b8860b] bg-clip-text font-serif text-5xl tracking-tight text-transparent md:text-6xl">
            Audio Master <span className="italic">to</span> Roblox
          </h1>
          <p className="mt-4 text-sm text-white/40">Convert · Tune · Upload · Track</p>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total', value: summary.total },
            { label: 'Active', value: summary.active },
            { label: 'Pending', value: summary.pending },
            { label: 'Copyright', value: summary.copyright },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[#d4af37]/20 bg-[#d4af37]/[0.03] px-4 py-4 text-center">
              <div className="text-2xl font-semibold tabular-nums text-[#f5d06f]">{stat.value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/35">{stat.label}</div>
            </div>
          ))}
        </div>

        <main className="mt-6 space-y-6">
          <section className={`${CARD} p-6 md:p-8`}>
            <SectionHeader
              num="01"
              title="Audio Settings"
              hint="Isi ini hanya kalau sudah paham. Untuk umumnya, biarkan saja nilai bawaan (default) — sudah diset paling enak untuk Roblox."
            />
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">Speed (Playback)</label>
                  <span className="text-[10px] text-white/25">makin besar = makin cepat</span>
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
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">Amplify (dB)</label>
                  <span className="text-[10px] text-white/25">minus = lebih pelan</span>
                </div>
                <input
                  type="number"
                  step="1"
                  value={amplify}
                  onChange={(e) => setAmplify(parseInt(e.target.value))}
                  className={INPUT}
                />
              </div>
              <div className="flex flex-col justify-end">
                <div className="rounded-xl border border-[#d4af37]/25 bg-gradient-to-br from-[#d4af37]/[0.12] to-transparent px-4 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#e6c15c]/70">Roblox playback</div>
                  <div className="mt-0.5 font-mono text-lg tabular-nums text-[#f5d06f]">
                    {calculateRobloxPlaybackSpeed()}
                  </div>
                </div>
                <button
                  onClick={() => { setSpeed(2.30); setAmplify(-4); }}
                  className="mt-2 text-left text-[10px] uppercase tracking-[0.15em] text-white/30 transition hover:text-[#e6c15c]"
                >
                  Reset ke bawaan
                </button>
              </div>
            </div>
          </section>

          <section className={`${CARD} p-6 md:p-8`}>
            <SectionHeader
              num="02"
              title="YouTube Converter"
              hint="Tempel link lagu YouTube, klik Tambah. Ulangi untuk tiap lagu. Setelah itu klik tombol Convert."
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={youtubeLinkInput}
                onChange={(e) => setYoutubeLinkInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addYoutubeLink(); } }}
                placeholder="Tempel link YouTube di sini, contoh: https://www.youtube.com/watch?v=..."
                className={`${INPUT} flex-1`}
              />
              <button onClick={addYoutubeLink} className={`${BTN_GHOST} shrink-0`}>
                + Tambah
              </button>
            </div>
            <p className="mt-2 text-xs text-white/35">Paste satu link, klik Tambah. Ulangi kalau mau lebih dari satu.</p>

            {youtubeLinks.length > 0 && (
              <div className="mt-4 space-y-2">
                {youtubeLinks.map((link, index) => (
                  <div key={index} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm text-white/70">{link}</span>
                    <button
                      onClick={() => removeYoutubeLink(index)}
                      disabled={downloading}
                      className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/50 transition hover:border-rose-400/30 hover:text-rose-300 disabled:opacity-50"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-white/35">
                {youtubeLinks.length === 0
                  ? 'Belum ada link ditambahkan'
                  : `${youtubeLinks.length} link siap ${autoUpload ? 'dikonversi & diupload' : 'dikonversi'}`}
              </p>
              <button onClick={handleYoutubeDownload} disabled={downloading} className={BTN_PRIMARY}>
                {downloading ? 'Memproses…' : (autoUpload ? 'Convert & Upload ke Roblox' : 'Convert ke MP3')}
              </button>
            </div>

            <button
              onClick={() => setAutoUpload(v => !v)}
              disabled={downloading}
              className={`mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition disabled:opacity-50 ${
                autoUpload
                  ? 'border-[#d4af37]/50 bg-[#d4af37]/10 text-[#f5d06f]'
                  : 'border-white/10 bg-black/30 text-white/45'
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${autoUpload ? 'bg-[#f5d06f]' : 'bg-white/25'}`} />
              Langsung upload ke Roblox {autoUpload ? 'ON' : 'OFF'}
            </button>
            <p className="mt-1.5 text-xs text-white/30">
              {autoUpload
                ? 'Aktif: setiap lagu otomatis diupload ke Roblox setelah dikonversi.'
                : 'Mati: lagu hanya dikonversi ke MP3 dan masuk ke daftar Upload di bawah.'}
            </p>

            <details className="mt-5 rounded-xl border border-white/10 bg-black/30">
              <summary className="cursor-pointer px-4 py-3 text-sm text-white/50 transition hover:text-white">
                YouTube Cookies <span className="text-xs text-white/30">(opsional — kalau kena "not a bot")</span>
              </summary>
              <div className="px-4 pb-4 pt-2">
                <textarea
                  value={youtubeCookies}
                  onChange={(e) => setYoutubeCookies(e.target.value)}
                  rows={6}
                  placeholder={'# Netscape HTTP Cookie File\n# Paste cookies.txt content here'}
                  className={`${INPUT} resize-y font-mono text-xs`}
                />
                <p className="mt-2 text-xs text-white/30">
                  Cara: install extension <span className="text-white/50">"Get cookies.txt LOCALLY"</span>, buka YouTube
                  (sudah login) → Export → buka file <span className="text-white/50">cookies.txt</span> → Ctrl+A, Ctrl+C → tempel di atas.
                  Tersimpan otomatis di browser ini.
                </p>
              </div>
            </details>

            {cookieHelpUrl && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setCookieHelpUrl(null)}>
                <div className="w-full max-w-lg rounded-2xl border border-[#d4af37]/25 bg-[#0d0d10] p-6" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-serif text-xl text-[#f5d06f]">Oops, kena "not a bot" 🤖</h3>
                      <p className="mt-1 text-xs text-white/40">YouTube curiga kita robot. Tenang, gampang kok.</p>
                    </div>
                    <button onClick={() => setCookieHelpUrl(null)} className="text-white/40 transition hover:text-white">✕</button>
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
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#d4af37]/30 text-xs text-[#e6c15c]">{i + 1}</span>
                        <div>
                          <div className="text-sm font-medium text-white/90">{title}</div>
                          <div className="mt-0.5 text-xs leading-relaxed text-white/50">{desc}</div>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <textarea
                    value={youtubeCookies}
                    onChange={(e) => setYoutubeCookies(e.target.value)}
                    rows={5}
                    placeholder={'Tempel isi cookies.txt di sini...'}
                    className={`${INPUT} mt-5 resize-y font-mono text-xs`}
                  />

                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => { setCookieHelpUrl(null); setYoutubeLinks(prev => prev.includes(cookieHelpUrl) ? prev : [...prev, cookieHelpUrl]); }}
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

            {downloadProgress.length > 0 && (
              <div className="mt-5 space-y-2">
                {downloadProgress.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      item.status === 'completed' ? 'bg-emerald-400' :
                      item.status === 'failed' ? 'bg-rose-400' : 'animate-pulse bg-[#f5d06f]'
                    }`} />
                    <span className="min-w-0 flex-1 truncate text-sm text-white/70">{item.url}</span>
                    <span className={`text-xs capitalize ${item.status === 'failed' ? 'text-rose-300/80' : 'text-white/40'}`}>
                      {item.status === 'completed' ? 'Selesai' : item.status === 'failed' ? 'Gagal' : 'Memproses…'}
                    </span>
                    {item.error && <span className="max-w-[45%] truncate text-xs text-rose-300/80" title={item.error}>{item.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={`${CARD} p-6 md:p-8`}>
            <SectionHeader
              num="03"
              title="Upload Files"
              hint="Lagu dari YouTube yang sudah dikonversi akan otomatis muncul di sini. Kamu juga bisa unggah file MP3 sendiri."
            />
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('fileInput')?.click()}
              className="cursor-pointer rounded-xl border border-dashed border-[#d4af37]/25 px-8 py-12 text-center transition hover:border-[#d4af37]/50 hover:bg-[#d4af37]/[0.03]"
            >
              <p className="text-sm text-white/60">Seret file ke sini, atau klik untuk pilih</p>
              <p className="mt-1 text-xs text-white/30">MP3 · OGG · FLAC · WAV</p>
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
              <div className="mt-5 space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-white/35">Terpilih · {files.length}</p>
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-white/80">{file.name}</span>
                    <button
                      onClick={() => removeFile(index)}
                      className="rounded-lg border border-white/10 px-3 py-1 text-xs text-white/50 transition hover:border-rose-400/30 hover:text-rose-300"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={`${CARD} p-6 md:p-8`}>
            <SectionHeader
              num="04"
              title="Roblox Account"
              hint="Isi sekali saja. API Key dari pengembang (fhrlsym), lalu pilih mau upload ke User atau Group dan masukkan ID-nya."
            />
            <div className="mb-6 grid gap-6 md:grid-cols-2">
              <div>
                <div className="mb-2 grid grid-cols-2 gap-2 rounded-xl border border-[#d4af37]/20 bg-black/40 p-1.5">
                  {(['user', 'group'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setTargetType(type)}
                      className={`rounded-lg py-2 text-sm font-medium transition ${
                        targetType === type
                          ? 'bg-gradient-to-r from-[#f5d06f] to-[#c9a227] text-black'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      {type === 'user' ? 'User' : 'Group'}
                    </button>
                  ))}
                </div>
                <label className={LABEL}>{targetType === 'user' ? 'User ID' : 'Group ID'}</label>
                <input
                  type="text"
                  value={targetType === 'user' ? userId : groupId}
                  onChange={(e) => targetType === 'user' ? setUserId(e.target.value) : setGroupId(e.target.value)}
                  placeholder={targetType === 'user' ? 'Enter Roblox User ID' : 'Enter Roblox Group ID'}
                  className={INPUT}
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">API Keys</label>
                  <button onClick={addApiKeyField} className="text-[11px] uppercase tracking-[0.15em] text-[#e6c15c] transition hover:text-[#f5d06f]">
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
                          className="shrink-0 rounded-xl border border-white/10 px-3 text-xs text-white/50 transition hover:border-rose-400/30 hover:text-rose-300"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#d4af37]/30 bg-gradient-to-br from-[#d4af37]/[0.08] via-transparent to-transparent p-6 md:p-8">
            <button
              onClick={uploadToRoblox}
              disabled={uploading}
              className="w-full rounded-xl bg-gradient-to-r from-[#f5d06f] via-[#e6c15c] to-[#c9a227] py-5 text-lg font-bold text-black shadow-[0_0_40px_rgba(212,175,55,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-white/10 disabled:via-white/10 disabled:to-white/10 disabled:text-white/40 disabled:shadow-none"
            >
              {uploading ? 'Mengupload…' : `Upload ke Roblox (${files.length} Audio)`}
            </button>
            <p className="mt-3 text-center text-xs text-white/35">
              {files.length > 0
                ? `Siap diupload ${files.length} file ke ${targetType === 'user' ? 'user' : 'group'} ${targetType === 'user' ? userId : groupId}`
                : 'Belum ada file audio. Convert dari YouTube atau unggah file dulu.'}
            </p>
          </section>

          {results.length > 0 && (
            <section className={`${CARD} p-6 md:p-8`}>
              <SectionHeader num="05" title="Hasil Upload" right={<button onClick={copyResults} className={BTN_GHOST}>Salin</button>} />
              <div className="space-y-2">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`rounded-xl border px-4 py-5 ${
                      result.success ? 'border-emerald-400/15 bg-emerald-400/[0.04]' : 'border-rose-400/15 bg-rose-400/[0.04]'
                    }`}
                  >
                    {result.success ? (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-serif text-lg leading-snug text-white">{result.filename}</div>
                          <StatusBadge status={result.status} />
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-lg border border-white/10 bg-black/40 px-4 py-3">
                            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Asset ID</div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <span className="truncate font-mono text-base tabular-nums text-white">{result.assetId}</span>
                              <button
                                onClick={() => copyAssetId(result.assetId)}
                                className="shrink-0 text-[10px] uppercase tracking-[0.15em] text-[#e6c15c] transition hover:text-[#f5d06f]"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/40 px-4 py-3">
                            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Roblox Playback</div>
                            <div className="mt-1 font-mono text-base tabular-nums text-[#f5d06f]">
                              {calculateRobloxPlaybackSpeed()}
                            </div>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/40 px-4 py-3">
                            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Tuning</div>
                            <div className="mt-1 font-mono text-base tabular-nums text-white/80">
                              {speed}x · {amplify}dB
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-medium text-white/90">{result.filename}</div>
                        <div className="mt-1 text-xs text-rose-300/80">{result.error}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={`${CARD} p-6 md:p-8`}>
            <SectionHeader
              num="06"
              title="Riwayat Upload"
              right={
                <button onClick={() => setShowHistory(!showHistory)} className={BTN_GHOST}>
                  {showHistory ? 'Sembunyikan' : 'Lihat'}
                </button>
              }
            />

            {showHistory && (
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {uploadHistory.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-black/40 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white/90">{item.name}</div>
                        <div className="mt-1 truncate font-mono text-xs text-white/45">{item.asset_id}</div>
                        {item.youtube_url && (
                          <div className="mt-1 truncate text-xs text-white/30">{item.youtube_url}</div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/35">
                          <span>Playback <span className="font-mono text-white/60">{item.roblox_playback_speed}</span></span>
                          <span>Speed <span className="font-mono text-white/60">{item.original_speed}x</span></span>
                          <span>Amplify <span className="font-mono text-white/60">{item.amplify}dB</span></span>
                        </div>
                        <div className="mt-1 text-xs text-white/25">{new Date(item.uploaded_at).toLocaleString()}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={item.status} />
                        {item.status === 'Pending' && (
                          <button
                            onClick={() => refreshStatus(item.asset_id)}
                            className="rounded-lg border border-[#d4af37]/25 px-2.5 py-1 text-[11px] text-[#e6c15c]/80 transition hover:bg-[#d4af37]/10 hover:text-[#f5d06f]"
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

        <footer className="mt-12 flex flex-col items-center gap-1 border-t border-[#d4af37]/10 pt-8 text-center">
          <p className="font-serif text-lg italic text-[#e6c15c]/70">S2 Studio — Audio Master to Roblox</p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/25">Created by fhrlsym</p>
        </footer>
      </div>
    </div>
  );
}
