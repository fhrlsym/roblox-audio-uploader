'use client';

import { useState, useEffect } from 'react';
import { supabase, AudioUpload } from '../lib/supabase';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const CORRECT_PIN = '515753';
const SETTINGS_KEY = 'audioUploader_settings';

const CARD = 'rounded-2xl border border-white/10 bg-white/[0.02] shadow-[0_1px_0_rgba(255,255,255,0.03)]';
const INPUT = 'w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none transition focus:border-white/30 focus:bg-black/60';
const LABEL = 'mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-white/40';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40';
const BTN_GHOST = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    Pending: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    Copyright: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
    Failed: 'border-white/10 bg-white/5 text-white/50',
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

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [targetType, setTargetType] = useState<'user' | 'group'>('user');
  const [userId, setUserId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [apiKeys, setApiKeys] = useState<string[]>(['']);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [youtubeUrls, setYoutubeUrls] = useState('');
  const [speed, setSpeed] = useState(2.30);
  const [amplify, setAmplify] = useState(-4);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<any[]>([]);

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
    }));
  }, [settingsLoaded, apiKeys, userId, groupId, targetType, speed, amplify]);

  useEffect(() => {
    if (isAuthenticated) {
      loadUploadHistory();
      const interval = setInterval(loadUploadHistory, 30000);
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

  const handleYoutubeDownload = async () => {
    const urls = youtubeUrls.split('\n').filter(url => url.trim());
    if (urls.length === 0) {
      alert('Please enter at least one YouTube URL');
      return;
    }

    setDownloading(true);
    setDownloadProgress([]);

    for (const url of urls) {
      try {
        setDownloadProgress(prev => [...prev, { url, status: 'downloading', progress: 0 }]);

        const response = await fetch(`${BACKEND_URL}/api/youtube-download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim(), speed, amplify }),
        });

        const data = await response.json();

        if (data.success) {
          const fileResponse = await fetch(`${BACKEND_URL}/api/download-file/${data.fileId}`);
          const blob = await fileResponse.blob();
          const file = new File([blob], data.filename, { type: 'audio/mpeg' });
          setFiles(prev => [...prev, file]);

          setDownloadProgress(prev =>
            prev.map(p => p.url === url ? { ...p, status: 'completed', progress: 100 } : p)
          );
        } else {
          setDownloadProgress(prev =>
            prev.map(p => p.url === url ? { ...p, status: 'failed', progress: 0 } : p)
          );
        }
      } catch (error) {
        setDownloadProgress(prev =>
          prev.map(p => p.url === url ? { ...p, status: 'failed', progress: 0 } : p)
        );
      }
    }

    setDownloading(false);
  };

  const uploadToRoblox = async () => {
    if (files.length === 0) {
      alert('Please select files or download from YouTube first');
      return;
    }

    const validApiKeys = apiKeys.filter(key => key.trim());
    if (validApiKeys.length === 0) {
      alert('Please enter at least one API key');
      return;
    }

    if (targetType === 'user' && !userId.trim()) {
      alert('Please enter User ID');
      return;
    }

    if (targetType === 'group' && !groupId.trim()) {
      alert('Please enter Group ID');
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

            const youtubeUrl = youtubeUrls.split('\n')[i]?.trim() || undefined;
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
    setYoutubeUrls('');
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

  const copyResults = () => {
    const text = results
      .filter(r => r.success)
      .map(r => `${r.filename}: ${r.assetId} (${r.status})`)
      .join('\n');
    navigator.clipboard.writeText(text);
    alert('Results copied to clipboard!');
  };

  const copyAssetId = async (assetId: string) => {
    await navigator.clipboard.writeText(assetId);
    alert('Asset ID copied!');
  };

  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08080a] p-4 text-white">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 right-1/4 h-72 w-72 rounded-full bg-white/[0.04] blur-[100px]" />

        <div className="relative w-full max-w-md">
          <div className="mb-10 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/40">S2 Studio</p>
            <h1 className="mt-3 font-serif text-4xl tracking-tight text-white">
              Audio Master <span className="italic text-white/40">to</span> Roblox
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
        <div className="absolute -top-48 right-[-10%] h-[30rem] w-[30rem] rounded-full bg-indigo-500/[0.07] blur-[140px]" />
        <div className="absolute bottom-[-20%] left-[-10%] h-[26rem] w-[26rem] rounded-full bg-white/[0.03] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-12 md:px-6">
        <header className="flex flex-wrap items-end justify-between gap-6 pb-10">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/40">S2 Studio</p>
            <h1 className="mt-3 font-serif text-4xl tracking-tight text-white md:text-5xl">
              Audio Master <span className="italic text-white/40">to</span> Roblox
            </h1>
            <p className="mt-3 text-sm text-white/40">Convert · Tune · Upload · Track</p>
          </div>
          <div className="flex gap-2">
            {[
              { label: 'Total', value: summary.total },
              { label: 'Active', value: summary.active },
              { label: 'Pending', value: summary.pending },
              { label: 'Copyright', value: summary.copyright },
            ].map((stat) => (
              <div key={stat.label} className="min-w-16 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-center">
                <div className="text-xl font-semibold tabular-nums">{stat.value}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-white/35">{stat.label}</div>
              </div>
            ))}
          </div>
        </header>

        <main className="space-y-6">
          <section className={`${CARD} p-6 md:p-8`}>
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <h2 className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/45">Audio Settings</h2>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <label className={LABEL}>Speed (Playback)</label>
                <input
                  type="number"
                  step="0.01"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Amplify (dB)</label>
                <input
                  type="number"
                  step="1"
                  value={amplify}
                  onChange={(e) => setAmplify(parseInt(e.target.value))}
                  className={INPUT}
                />
              </div>
              <div className="flex flex-col justify-end">
                <div className="rounded-xl border border-indigo-400/20 bg-indigo-400/[0.06] px-4 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-indigo-300/70">Roblox playback</div>
                  <div className="mt-0.5 font-mono text-lg tabular-nums text-indigo-200">
                    {calculateRobloxPlaybackSpeed()}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={`${CARD} p-6 md:p-8`}>
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <h2 className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/45">YouTube Converter</h2>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <textarea
              value={youtubeUrls}
              onChange={(e) => setYoutubeUrls(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              rows={5}
              className={`${INPUT} resize-y font-mono`}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-white/35">One URL per line · downloaded files appear below</p>
              <button onClick={handleYoutubeDownload} disabled={downloading} className={BTN_PRIMARY}>
                {downloading ? 'Converting…' : 'Download & Convert to MP3'}
              </button>
            </div>

            {downloadProgress.length > 0 && (
              <div className="mt-5 space-y-2">
                {downloadProgress.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      item.status === 'completed' ? 'bg-emerald-400' :
                      item.status === 'failed' ? 'bg-rose-400' : 'animate-pulse bg-amber-400'
                    }`} />
                    <span className="min-w-0 flex-1 truncate text-sm text-white/70">{item.url}</span>
                    <span className="text-xs capitalize text-white/40">{item.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={`${CARD} p-6 md:p-8`}>
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <h2 className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/45">Upload Files</h2>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('fileInput')?.click()}
              className="cursor-pointer rounded-xl border border-dashed border-white/15 px-8 py-12 text-center transition hover:border-white/30 hover:bg-white/[0.02]"
            >
              <p className="text-sm text-white/60">Drag &amp; drop files, or click to browse</p>
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
                <p className="text-xs uppercase tracking-[0.2em] text-white/35">Selected · {files.length}</p>
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-white/80">{file.name}</span>
                    <button
                      onClick={() => removeFile(index)}
                      className="rounded-lg border border-white/10 px-3 py-1 text-xs text-white/50 transition hover:border-rose-400/30 hover:text-rose-300"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={`${CARD} p-6 md:p-8`}>
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <h2 className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/45">Roblox Settings</h2>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/30 p-1.5">
              {(['user', 'group'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTargetType(type)}
                  className={`rounded-lg py-2 text-sm font-medium transition ${
                    targetType === type ? 'bg-white text-black' : 'text-white/50 hover:text-white'
                  }`}
                >
                  {type === 'user' ? 'User' : 'Group'}
                </button>
              ))}
            </div>

            <div className="mb-6 grid gap-6 md:grid-cols-2">
              <div>
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
                  <button onClick={addApiKeyField} className="text-[11px] uppercase tracking-[0.15em] text-indigo-300 transition hover:text-indigo-200">
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

            <button onClick={uploadToRoblox} disabled={uploading} className={`${BTN_PRIMARY} w-full py-4 text-base`}>
              {uploading ? 'Uploading…' : 'Upload to Roblox'}
            </button>
          </section>

          {results.length > 0 && (
            <section className={`${CARD} p-6 md:p-8`}>
              <div className="mb-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/10" />
                <h2 className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/45">Upload Results</h2>
                <button onClick={copyResults} className={BTN_GHOST}>Copy</button>
                <span className="h-px flex-1 bg-white/10" />
              </div>
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
                          <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Asset ID</div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <span className="truncate font-mono text-base tabular-nums text-white">{result.assetId}</span>
                              <button
                                onClick={() => copyAssetId(result.assetId)}
                                className="shrink-0 text-[10px] uppercase tracking-[0.15em] text-indigo-300 transition hover:text-indigo-200"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Roblox Playback</div>
                            <div className="mt-1 font-mono text-base tabular-nums text-indigo-200">
                              {calculateRobloxPlaybackSpeed()}
                            </div>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
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
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <h2 className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/45">Upload History</h2>
              <button onClick={() => setShowHistory(!showHistory)} className={BTN_GHOST}>
                {showHistory ? 'Hide' : 'Show'}
              </button>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {showHistory && (
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {uploadHistory.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-black/30 px-4 py-4">
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
                            className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/60 transition hover:bg-white/5 hover:text-white"
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

        <footer className="mt-12 flex flex-col items-center gap-1 border-t border-white/5 pt-8 text-center">
          <p className="font-serif text-lg italic text-white/60">S2 Studio — Audio Master to Roblox</p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/25">Created by fhrlsym</p>
        </footer>
      </div>
    </div>
  );
}
