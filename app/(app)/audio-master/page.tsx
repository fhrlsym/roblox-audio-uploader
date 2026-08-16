'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Music, SlidersHorizontal, CloudUpload, Check, Upload, Video, Headphones, FileAudio, X } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Tabs } from '../../../components/ui/tabs';
import { Slider } from '../../../components/ui/slider';
import { Progress } from '../../../components/ui/progress';
import { StatusBadge } from '../../../components/shared/status-badge';
import { useAudioStore, type RawFile, type TunedFile } from '../../../lib/stores/audioStore';
import { useAccountStore } from '../../../lib/stores/accountStore';
import { useUIStore } from '../../../lib/stores/uiStore';
import { AudioService } from '../../../lib/services/audio.service';
import { useUploadSuccess } from '../../../lib/queries/useUploadHistory';

const steps = [
  { id: 1, label: 'Input', icon: Music },
  { id: 2, label: 'Tuning', icon: SlidersHorizontal },
  { id: 3, label: 'Upload', icon: CloudUpload },
];

const inputTabs = [
  { id: 'file', label: 'File', icon: <FileAudio size={16} /> },
  { id: 'youtube', label: 'YouTube', icon: <Video size={16} /> },
  { id: 'soundcloud', label: 'SoundCloud', icon: <Headphones size={16} /> },
];

export default function AudioMasterPage() {
  const { activeStep, rawFiles, tunedFiles, setStep, addRawFiles, removeRawFile, addTunedFiles, clearAll } = useAudioStore();
  const accounts = useAccountStore((s) => s.accounts);
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const addToast = useUIStore((s) => s.addToast);
  const uploadSuccess = useUploadSuccess();
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const [inputTab, setInputTab] = useState('file');
  const [ytUrl, setYtUrl] = useState('');
  const [scUrl, setScUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const [speed, setSpeed] = useState(2.3);
  const [amplify, setAmplify] = useState(-4);
  const [tuningProgress, setTuningProgress] = useState(0);
  const [tuning, setTuning] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ name: string; assetId?: string; success: boolean; error?: string }[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles: RawFile[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name.replace(/\.[^/.]+$/, ''),
      file: f,
      source: 'file' as const,
    }));
    addRawFiles(newFiles);
    if (newFiles.length > 0) setStep(2);
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('audio/'));
    const newFiles: RawFile[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name.replace(/\.[^/.]+$/, ''),
      file: f,
      source: 'file' as const,
    }));
    addRawFiles(newFiles);
    if (newFiles.length > 0) setStep(2);
  }, [addRawFiles, setStep]);

  const handleYtFetch = async () => {
    if (!ytUrl) return;
    setLoading(true);
    try {
      const cookies = useUIStore.getState().youtubeCookies;
      const info = await AudioService.fetchYoutubeInfo(ytUrl, cookies);
      addRawFiles([{
        id: crypto.randomUUID(),
        name: info.title,
        source: 'youtube',
        sourceUrl: ytUrl,
        thumbnail: info.thumbnail,
        channel: info.channel,
        duration: info.duration,
      }]);
      setYtUrl('');
      setStep(2);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to fetch YouTube info', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleScFetch = async () => {
    if (!scUrl) return;
    setLoading(true);
    try {
      const info = await AudioService.fetchSoundCloudInfo(scUrl);
      addRawFiles([{
        id: crypto.randomUUID(),
        name: info.title,
        source: 'soundcloud',
        sourceUrl: scUrl,
        duration: info.duration,
      }]);
      setScUrl('');
      setStep(2);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to fetch SoundCloud info', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTuneAll = async () => {
    setTuning(true);
    setTuningProgress(0);
    const newTuned: TunedFile[] = [];

    for (let i = 0; i < rawFiles.length; i++) {
      const raw = rawFiles[i];
      try {
        let blob: Blob | null = null;
        if (raw.file) {
          const { processAudio } = await import('../../../lib/audioProcessor');
          blob = await processAudio(raw.file, speed, amplify);
        } else if (raw.source === 'youtube' || raw.source === 'soundcloud') {
          const downloadFn = raw.source === 'youtube' ? AudioService.downloadYoutube : AudioService.downloadSoundCloud;
          const cookies = raw.source === 'youtube' ? useUIStore.getState().youtubeCookies : undefined;
          const result = await downloadFn(raw.sourceUrl!, cookies as string | undefined);
          const res = await fetch(AudioService.getDownloadUrl(result.fileId));
          const arrayBuffer = await res.arrayBuffer();
          const { processAudio } = await import('../../../lib/audioProcessor');
          blob = await processAudio(new File([arrayBuffer], `${raw.name}.mp3`, { type: 'audio/mpeg' }), speed, amplify);
        }
        if (blob) {
          newTuned.push({
            id: crypto.randomUUID(),
            originalName: raw.name,
            speed,
            amplify,
            blob,
            blobUrl: URL.createObjectURL(blob),
          });
        }
      } catch (err: unknown) {
        addToast(`Failed to tune "${raw.name}": ${err instanceof Error ? err.message : 'Error'}`, 'error');
      }
      setTuningProgress(((i + 1) / rawFiles.length) * 100);
    }

    addTunedFiles(newTuned);
    setTuning(false);
    if (newTuned.length > 0) setStep(3);
  };

  const handleUploadAll = async () => {
    if (!selectedAccount) {
      addToast('Select an account first', 'error');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    const results: typeof uploadResults = [];

    for (let i = 0; i < tunedFiles.length; i++) {
      const tf = tunedFiles[i];
      try {
        if (!tf.blob) throw new Error('No blob available');
        const operationId = await AudioService.uploadToRoblox(
          tf.blob,
          tf.originalName,
          {
            creatorType: selectedAccount.type === 'group' ? 'Group' : 'User',
            creatorId: selectedAccount.type === 'group'
              ? selectedAccount.groupId || selectedAccount.id
              : selectedAccount.userId || selectedAccount.id,
            apiKey: selectedAccount.apiKey,
          }
        );
        const result = await AudioService.pollOperation(operationId, selectedAccount.apiKey);
        if (result.assetId) {
          results.push({ name: tf.originalName, assetId: result.assetId, success: true });
          await uploadSuccess.mutateAsync({
            assetId: result.assetId,
            name: tf.originalName,
            speed: tf.speed,
            amplify: tf.amplify,
            accountName: selectedAccount.displayName || selectedAccount.name,
          });
        } else {
          results.push({ name: tf.originalName, success: false, error: result.error || 'Upload failed' });
        }
      } catch (err: unknown) {
        results.push({ name: tf.originalName, success: false, error: err instanceof Error ? err.message : 'Error' });
      }
      setUploadProgress(((i + 1) / tunedFiles.length) * 100);
    }

    setUploadResults(results);
    setUploading(false);

    const successCount = results.filter((r) => r.success).length;
    if (successCount > 0) {
      addToast(`${successCount} file(s) uploaded successfully!`, 'success');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">Audio Master</h1>
          <p className="text-xs text-[var(--text-50)]">Upload, tune & publish audio to Roblox</p>
        </div>
        {(rawFiles.length > 0 || tunedFiles.length > 0) && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X size={14} />
            Clear All
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2 sm:gap-4 flex-1">
            <button
              onClick={() => setStep(step.id as 1 | 2 | 3)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition ${
                activeStep === step.id
                  ? 'bg-[var(--accent-12)] text-[var(--accent-strong)]'
                  : activeStep > step.id
                  ? 'text-emerald-400'
                  : 'text-[var(--text-40)]'
              }`}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                activeStep === step.id
                  ? 'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-[var(--on-accent)]'
                  : activeStep > step.id
                  ? 'bg-emerald-400/20 text-emerald-400'
                  : 'bg-[var(--surface-strong)] text-[var(--text-40)]'
              }`}>
                {activeStep > step.id ? <Check size={12} /> : <step.icon size={12} />}
              </div>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px ${
                activeStep > step.id ? 'bg-emerald-400/40' : 'bg-[var(--line)]'
              }`} />
            )}
          </div>
        ))}
      </div>

      {activeStep === 1 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Tabs tabs={inputTabs} active={inputTab} onChange={setInputTab} className="mb-4" />

          {inputTab === 'file' && (
            <Card>
              <CardContent className="p-6">
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-[var(--line)] rounded-2xl p-8 text-center hover:border-[var(--accent-30)] transition cursor-pointer group"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--accent-10)] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition">
                    <Upload size={20} className="text-[var(--accent-strong)]" />
                  </div>
                  <p className="text-sm font-medium text-[var(--text-70)]">Drop audio files here or click to browse</p>
                  <p className="text-[10px] text-[var(--text-35)] mt-1">Supports MP3, WAV, FLAC, OGG</p>
                  <input
                    id="file-input"
                    type="file"
                    accept="audio/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {inputTab === 'youtube' && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      value={ytUrl}
                      onChange={(e) => setYtUrl(e.target.value)}
                      placeholder="Paste YouTube URL..."
                      onKeyDown={(e) => e.key === 'Enter' && handleYtFetch()}
                    />
                  </div>
                  <Button onClick={handleYtFetch} loading={loading} disabled={!ytUrl}>
                    <Video size={16} />
                    Fetch
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {inputTab === 'soundcloud' && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      value={scUrl}
                      onChange={(e) => setScUrl(e.target.value)}
                      placeholder="Paste SoundCloud URL..."
                      onKeyDown={(e) => e.key === 'Enter' && handleScFetch()}
                    />
                  </div>
                  <Button onClick={handleScFetch} loading={loading} disabled={!scUrl}>
                    <Headphones size={16} />
                    Fetch
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {activeStep === 2 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Tuning Settings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Slider
                    label="Speed"
                    min={0.5}
                    max={5}
                    step={0.05}
                    value={speed}
                    onChange={setSpeed}
                    formatValue={(v) => `${v.toFixed(2)}x`}
                  />
                  <Slider
                    label="Amplify"
                    min={-20}
                    max={20}
                    step={1}
                    value={amplify}
                    onChange={setAmplify}
                    formatValue={(v) => `${v > 0 ? '+' : ''}${v} dB`}
                  />
                </div>
                <div className="mt-3 text-xs text-[var(--text-45)]">
                  Roblox Playback Speed: <span className="font-mono text-[var(--accent-strong)]">{(1 / speed).toFixed(3)}x</span>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Roblox Standard', s: 2.3, a: -4 },
                  { label: 'Fast & Clear', s: 2.75, a: -6 },
                  { label: 'Deep & Warm', s: 1.8, a: -2 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => { setSpeed(preset.s); setAmplify(preset.a); }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-medium border transition ${
                      speed === preset.s && amplify === preset.a
                        ? 'border-[var(--accent-30)] bg-[var(--accent-10)] text-[var(--accent-strong)]'
                        : 'border-[var(--line)] text-[var(--text-50)] hover:border-[var(--accent-25)]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--text)]">Files ({rawFiles.length})</h3>
                <Button size="sm" onClick={handleTuneAll} loading={tuning} disabled={rawFiles.length === 0}>
                  <SlidersHorizontal size={14} />
                  Tune All
                </Button>
              </div>
              {tuning && <Progress value={tuningProgress} className="mb-3" />}
              <div className="space-y-2">
                {rawFiles.map((rf) => (
                  <div key={rf.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-soft)]">
                    <Music size={14} className="text-[var(--text-40)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[var(--text)] truncate">{rf.name}</div>
                      <div className="text-[10px] text-[var(--text-40)] capitalize">{rf.source}</div>
                    </div>
                    <button onClick={() => removeRawFile(rf.id)} className="p-1 rounded hover:bg-[var(--surface-strong)] text-[var(--text-40)]">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {rawFiles.length === 0 && (
                  <p className="text-xs text-[var(--text-40)] text-center py-4">No files yet. Go back to Input step.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {activeStep === 3 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--text)]">Upload to Roblox</h3>
                <div className="flex items-center gap-2">
                  {!selectedAccount && (
                    <span className="text-[10px] text-[var(--danger)]">No account selected</span>
                  )}
                  <Button size="sm" onClick={handleUploadAll} loading={uploading} disabled={tunedFiles.length === 0 || !selectedAccount}>
                    <CloudUpload size={14} />
                    Upload All
                  </Button>
                </div>
              </div>
              {uploading && <Progress value={uploadProgress} className="mb-3" showLabel />}
              <div className="space-y-2">
                {tunedFiles.map((tf) => {
                  const result = uploadResults.find((r) => r.name === tf.originalName);
                  return (
                    <div key={tf.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-soft)]">
                      <Music size={14} className="text-[var(--text-40)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[var(--text)] truncate">{tf.originalName}</div>
                        <div className="text-[10px] text-[var(--text-40)]">
                          {tf.speed.toFixed(2)}x · {tf.amplify > 0 ? '+' : ''}{tf.amplify} dB
                        </div>
                      </div>
                      {result && (
                        result.success && result.assetId ? (
                          <div className="text-right">
                            <StatusBadge status="Active" />
                            <div className="text-[9px] text-[var(--text-35)] mt-0.5 font-mono">{result.assetId.slice(0, 10)}...</div>
                          </div>
                        ) : (
                          <div className="text-right">
                            <StatusBadge status="Failed" />
                            <div className="text-[9px] text-rose-400/70 mt-0.5 max-w-[120px] truncate">{result.error}</div>
                          </div>
                        )
                      )}
                      {!result && !uploading && (
                        <StatusBadge status="Pending" />
                      )}
                    </div>
                  );
                })}
                {tunedFiles.length === 0 && (
                  <p className="text-xs text-[var(--text-40)] text-center py-4">No tuned files yet. Go back to Tuning step.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}