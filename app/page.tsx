'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, AudioUpload, SavedAccountRow } from '../lib/supabase';

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
  file?: File;
  fileId?: string;
  name?: string;
  video?: VideoInfo;
}

interface RobloxAccount {
  id: string;
  type: 'user' | 'group';
  name: string;
  displayName?: string;
  memberCount?: number;
  hasVerifiedBadge?: boolean;
  thumbnail?: string | null;
  apiKey: string;
  ownerId?: string;
  ownerName?: string;
  audioUsage?: number;
  audioCapacity?: number;
}

interface KeyOwnerInfo {
  id: string;
  name: string;
  displayName?: string | null;
  hasVerifiedBadge?: boolean;
  thumbnail?: string | null;
}

interface KeyGroupInfo {
  id: string;
  name: string;
  memberCount?: number;
  hasVerifiedBadge?: boolean;
  thumbnail?: string | null;
}

interface KeyAudioQuota {
  usage?: number | null;
  capacity?: number | null;
  period?: string;
  usageResetTime?: string | null;
}

interface KeyInfoResult {
  success: boolean;
  keyName?: string | null;
  owner: KeyOwnerInfo;
  audioQuota: KeyAudioQuota | null;
  groups: KeyGroupInfo[];
  scopeGroupIds?: string[];
  scopeUserIds?: string[];
}

interface UploadResult {
  filename: string;
  success: boolean;
  assetId?: string;
  status?: string;
  error?: string;
  pending?: boolean;
  step?: 'uploading' | 'moderating';
}

interface DownloadProgressItem {
  url: string;
  video?: VideoInfo;
  status: 'downloading' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

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
    Success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
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

function QuotaBar({ usage, capacity }: { usage?: number; capacity?: number }) {
  if (usage == null || capacity == null || capacity <= 0) return null;
  const pct = Math.min(100, (usage / capacity) * 100);
  const color = pct >= 90 ? 'bg-rose-400' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="mt-1 w-full">
      <div className="flex items-center justify-between text-[10px] text-[var(--text-35)]">
        <span>Kuota audio bulan ini</span>
        <span className="font-medium text-[var(--text-50)]">
          {usage.toLocaleString('id-ID')} / {capacity.toLocaleString('id-ID')}
        </span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const ICON = 'h-4 w-4';

function IconYoutube() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/>
    </svg>
  );
}

function IconUpload() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

function IconFile() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <polyline points="13 2 13 9 20 9"/>
    </svg>
  );
}

function IconUser() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function IconUsers() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function IconKey() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  );
}

function IconPlus() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function IconLink() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}

function maskApiKey(key?: string | null) {
  if (!key) return null;
  const trimmed = key.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= 4) return '••••';
  return `••••••${trimmed.slice(-4)}`;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [files, setFiles] = useState<UploadFileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [targetType, setTargetType] = useState<'user' | 'group'>('user');
  const [userId, setUserId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [youtubeCookies, setYoutubeCookies] = useState('');

  const [savedAccounts, setSavedAccounts] = useState<RobloxAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [showAccountSearch, setShowAccountSearch] = useState(false);
  const [accountApiKey, setAccountApiKey] = useState('');
  const [keyChecking, setKeyChecking] = useState(false);
  const [keyInfo, setKeyInfo] = useState<KeyInfoResult | null>(null);
  const [keyInfoError, setKeyInfoError] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const [youtubeLinks, setYoutubeLinks] = useState<YoutubeLinkEntry[]>([]);
  const [youtubeLinkInput, setYoutubeLinkInput] = useState('');
  const [sourceTab, setSourceTab] = useState<'youtube' | 'file'>('youtube');
  const [speed, setSpeed] = useState(2.30);
  const [amplify, setAmplify] = useState(-4);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressItem[]>([]);
  const [autoUpload, setAutoUpload] = useState(false);
  const [cookieHelpUrl, setCookieHelpUrl] = useState<string | null>(null);

  const [uploadHistory, setUploadHistory] = useState<AudioUpload[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, pending: 0, failed: 0, copyright: 0 });

  const [theme, setTheme] = useState<string>('gold-dark');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [backendInfo, setBackendInfo] = useState<{ commit?: string | null; startedAt?: string | null } | null>(null);
  const downloadLockRef = useRef(false);
  const statusRefreshLockRef = useRef(false);
  const savedAccountsRef = useRef<RobloxAccount[]>([]);
  const resultsRef = useRef<UploadResult[]>([]);
  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    savedAccountsRef.current = savedAccounts;
  }, [savedAccounts]);

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
        if (typeof s.userId === 'string') setUserId(s.userId);
        if (typeof s.groupId === 'string') setGroupId(s.groupId);
        if (s.targetType === 'user' || s.targetType === 'group') setTargetType(s.targetType);
        if (typeof s.speed === 'number') setSpeed(s.speed);
        if (typeof s.amplify === 'number') setAmplify(s.amplify);
        if (typeof s.youtubeCookies === 'string') setYoutubeCookies(s.youtubeCookies);
        if (typeof s.autoUpload === 'boolean') setAutoUpload(s.autoUpload);
        if (typeof s.theme === 'string') setTheme(s.theme);
        if (Array.isArray(s.savedAccounts) && s.savedAccounts.length > 0) setSavedAccounts(s.savedAccounts.map((a: RobloxAccount) => ({ ...a, apiKey: a.apiKey || '' })));
        if (typeof s.selectedAccountId === 'string') setSelectedAccountId(s.selectedAccountId);

        const legacyId = s.targetType === 'group' ? (s.groupId || '') : (s.userId || '');
        const hasSavedAccounts = Array.isArray(s.savedAccounts) && s.savedAccounts.length > 0;
        if (!hasSavedAccounts && legacyId.trim()) {
          setSavedAccounts([{
            id: legacyId.trim(),
            type: s.targetType === 'group' ? 'group' : 'user',
            name: s.targetType === 'group' ? `Group ${legacyId.trim()}` : `User ${legacyId.trim()}`,
            thumbnail: null,
            apiKey: s.apiKeys && Array.isArray(s.apiKeys) ? (s.apiKeys[0] || '') : '',
          }]);
          setSelectedAccountId(legacyId.trim());
        }
      }
    } catch {
      // ignore corrupt saved settings
    }
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      userId,
      groupId,
      targetType,
      speed,
      amplify,
      youtubeCookies,
      autoUpload,
      theme,
      savedAccounts,
      selectedAccountId,
    }));
  }, [settingsLoaded, userId, groupId, targetType, speed, amplify, youtubeCookies, autoUpload, theme, savedAccounts, selectedAccountId]);

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

  const saveToDatabase = async (assetId: string, name: string, status: string, youtubeUrl?: string, accountId?: string) => {
    await supabase.from('audio_uploads').insert({
      asset_id: assetId,
      name: name,
      status: status,
      original_speed: speed,
      amplify: amplify,
      roblox_playback_speed: parseFloat(calculateRobloxPlaybackSpeed()),
      youtube_url: youtubeUrl || null,
      account_id: accountId || null,
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

  const selectedAccount = savedAccounts.find(a => a.id === selectedAccountId) || null;

  const selectAccount = (account: RobloxAccount) => {
    setSelectedAccountId(account.id);
    setTargetType(account.type);
    if (account.type === 'user') {
      setUserId(account.id);
      setGroupId('');
    } else {
      setGroupId(account.id);
      setUserId('');
    }
  };

  const accountToRow = (a: RobloxAccount): SavedAccountRow => ({
    id: a.id,
    type: a.type,
    name: a.name,
    display_name: a.displayName ?? null,
    member_count: a.memberCount ?? null,
    has_verified_badge: a.hasVerifiedBadge ?? false,
    thumbnail: a.thumbnail ?? null,
    api_key: a.apiKey,
    owner_id: a.ownerId ?? null,
    owner_name: a.ownerName ?? null,
    audio_usage: a.audioUsage ?? null,
    audio_capacity: a.audioCapacity ?? null,
  });

  const rowToAccount = (r: SavedAccountRow): RobloxAccount => ({
    id: r.id,
    type: r.type,
    name: r.name,
    displayName: r.display_name ?? undefined,
    memberCount: r.member_count ?? undefined,
    hasVerifiedBadge: !!r.has_verified_badge,
    thumbnail: r.thumbnail ?? null,
    apiKey: r.api_key || '',
    ownerId: r.owner_id ?? undefined,
    ownerName: r.owner_name ?? undefined,
    audioUsage: r.audio_usage ?? undefined,
    audioCapacity: r.audio_capacity ?? undefined,
  });

  const loadSavedAccountsFromDb = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_accounts')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        const accounts = data.map(rowToAccount);
        setSavedAccounts(accounts);
        refreshAccountQuotas(accounts);
      } else if (savedAccounts.length > 0) {
        const { error: upsertError } = await supabase
          .from('saved_accounts')
          .upsert(savedAccounts.map(accountToRow));
        if (upsertError) throw upsertError;
      }
    } catch (e) {
      console.error('Gagal memuat akun dari database:', e);
    }
  };

  const refreshAccountQuotas = async (accounts: RobloxAccount[]) => {
    const withKey = accounts.filter(a => a.apiKey.trim());
    if (withKey.length === 0) return;
    const results = await Promise.all(
      withKey.map(async (a) => {
        try {
          const response = await fetch(
            `${BACKEND_URL}/api/roblox/key-info?apiKey=${encodeURIComponent(a.apiKey)}`
          );
          const data = await response.json();
          if (!response.ok || !data.owner) return null;
          return {
            id: a.id,
            type: a.type,
            ownerId: data.owner.id,
            ownerName: data.owner.name,
            audioUsage: data.audioQuota?.usage ?? undefined,
            audioCapacity: data.audioQuota?.capacity ?? undefined,
          };
        } catch {
          return null;
        }
      })
    );
    const updates = results.filter((r): r is NonNullable<typeof r> => r !== null);
    if (updates.length === 0) return;
    setSavedAccounts(prev => prev.map(a => {
      const upd = updates.find(u => u.id === a.id && u.type === a.type);
      return upd ? { ...a, ...upd } : a;
    }));
  };

  const removeAccount = async (id: string) => {
    const account = savedAccounts.find(a => a.id === id);
    setSavedAccounts(prev => prev.filter(a => a.id !== id));
    if (selectedAccountId === id) {
      setSelectedAccountId('');
    }
    if (account) {
      try {
        await supabase
          .from('saved_accounts')
          .delete()
          .eq('id', account.id)
          .eq('type', account.type);
      } catch (e) {
        console.error('Gagal menghapus akun dari database:', e);
      }
    }
  };

  const buildAccountFromKeyInfo = (info: KeyInfoResult, apiKey: string, groupId: string): RobloxAccount => {
    const owner = info.owner;
    const quota = info.audioQuota;
    const base = {
      apiKey,
      ownerId: owner.id,
      ownerName: owner.name,
      audioUsage: quota?.usage ?? undefined,
      audioCapacity: quota?.capacity ?? undefined,
    };
    const group = info.groups.find((g) => g.id === groupId);
    if (group) {
      return {
        ...base,
        id: group.id,
        type: 'group' as const,
        name: group.name,
        memberCount: group.memberCount,
        hasVerifiedBadge: group.hasVerifiedBadge,
        thumbnail: group.thumbnail,
      };
    }
    return {
      ...base,
      id: owner.id,
      type: 'user' as const,
      name: owner.name,
      displayName: owner.displayName || undefined,
      hasVerifiedBadge: owner.hasVerifiedBadge,
      thumbnail: owner.thumbnail,
    };
  };

  const checkAccountKey = async () => {
    const apiKey = accountApiKey.trim();
    if (!apiKey) {
      addToast('Masukkan API key terlebih dahulu', 'error');
      return;
    }
    setKeyChecking(true);
    setKeyInfo(null);
    setKeyInfoError('');
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/roblox/key-info?apiKey=${encodeURIComponent(apiKey)}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memeriksa API key');
      setKeyInfo(data);
      setSelectedGroupId(data.groups && data.groups.length > 0 ? data.groups[0].id : '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memeriksa API key';
      setKeyInfoError(message);
      addToast(message, 'error');
    }
    setKeyChecking(false);
  };

  const addSavedAccount = async () => {
    if (!keyInfo) return;
    const account = buildAccountFromKeyInfo(keyInfo, accountApiKey.trim(), selectedGroupId);
    setSavedAccounts(prev => {
      if (prev.some(a => a.id === account.id && a.type === account.type)) {
        return prev.map(a => a.id === account.id && a.type === account.type ? { ...a, ...account } : a);
      }
      return [...prev, account];
    });
    try {
      const { error } = await supabase.from('saved_accounts').upsert(accountToRow(account));
      if (error) throw error;
    } catch (e) {
      console.error('Gagal menyimpan akun ke database:', e);
      addToast('Akun tersimpan lokal saja (gagal sync database)', 'error');
    }
    selectAccount(account);
    setShowAccountSearch(false);
    setAccountApiKey('');
    setKeyInfo(null);
    setSelectedGroupId('');
    addToast(`${account.type === 'user' ? 'User' : 'Group'} "${account.displayName || account.name}" ditambahkan`, 'success');
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

    if (autoUpload) {
      if (!selectedAccount) {
        addToast('Auto-upload aktif tapi akun Roblox belum dipilih', 'error');
        return;
      }
      if (!selectedAccount.apiKey.trim()) {
        addToast('Akun Roblox belum punya API Key', 'error');
        return;
      }
    }

    downloadLockRef.current = true;

    setDownloading(true);
    setDownloadProgress(urls.map(({ url, video }) => ({ url, video, status: 'downloading', progress: 0 })));
    if (autoUpload) setResults([]);

    const processUrl = async (url: string, entry: YoutubeLinkEntry) => {
      try {
        if (autoUpload) {
          const apiKey = selectedAccount!.apiKey;
          const response = await fetch(`${BACKEND_URL}/api/youtube-upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: url.trim(),
              speed,
              amplify,
              cookies: youtubeCookies,
              description: `Speed: ${speed}x | Amplify: ${amplify}dB | Roblox Playback: ${calculateRobloxPlaybackSpeed()}`,
              creatorType: selectedAccount?.type,
              creatorId: selectedAccount?.id,
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
              await saveToDatabase(assetId, name, status, url.trim(), selectedAccount?.id);
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
            setFiles(prev => [...prev, { fileId: data.fileId, name: data.filename, video: entry.video }]);
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
        await processUrl(urls[index].url, urls[index]);
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

    if (!selectedAccount) {
      addToast('Pilih akun Roblox terlebih dahulu', 'error');
      return;
    }

    if (!selectedAccount.apiKey.trim()) {
      addToast('Akun Roblox belum punya API Key', 'error');
      return;
    }

    setUploading(true);
    setResults(files.map((entry) => ({
      filename: entry.name || entry.file?.name || 'audio',
      success: false,
      pending: true,
      step: 'uploading',
    })));

    const updateResult = (index: number, patch: Partial<UploadResult>) =>
      setResults(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r));

    const CONCURRENCY = 3;
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < files.length) {
        const i = nextIndex++;
        const entry = files[i];
        const apiKey = selectedAccount.apiKey;
        const filename = entry.name || entry.file?.name || 'audio';

        try {
          const description = `Speed: ${speed}x | Amplify: ${amplify}dB | Roblox Playback: ${calculateRobloxPlaybackSpeed()}`;
          let response: Response;

          if (entry.fileId) {
            response = await fetch(`${BACKEND_URL}/api/upload-converted`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileId: entry.fileId,
                displayName: (entry.name || entry.file?.name || 'audio').replace(/\.[^/.]+$/, ''),
                description,
                creatorType: selectedAccount.type,
                creatorId: selectedAccount.id,
                apiKey,
              }),
            });
          } else {
            const file = entry.file!;
            const formData = new FormData();
            formData.append('file', file);
            formData.append('assetType', 'Audio');
            formData.append('displayName', file.name.replace(/\.[^/.]+$/, ''));
            formData.append('description', description);
            formData.append('creatorType', selectedAccount.type);
            formData.append('creatorId', selectedAccount.id);
            formData.append('apiKey', apiKey);

            response = await fetch(`${BACKEND_URL}/api/upload-to-roblox`, {
              method: 'POST',
              body: formData,
            });
          }

          const result = await response.json();

          if (response.ok && result.operationId) {
            updateResult(i, { step: 'moderating' });

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
              updateResult(i, {
                filename,
                assetId,
                status,
                success: true,
                pending: false,
                step: undefined,
              });

              const youtubeUrl = youtubeLinks[i]?.url?.trim() || undefined;
              await saveToDatabase(assetId, filename, status, youtubeUrl, selectedAccount?.id);
            } else {
              updateResult(i, {
                filename,
                error: opError || 'Upload is still processing after 6 minutes',
                success: false,
                pending: false,
                step: undefined,
              });
            }
          } else {
            updateResult(i, {
              filename,
              error: result.error || result.message || 'Upload failed',
              success: false,
              pending: false,
              step: undefined,
            });
          }
        } catch (error) {
          updateResult(i, {
            filename,
            error: error instanceof Error ? error.message : 'Upload failed',
            success: false,
            pending: false,
            step: undefined,
          });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));

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
    const { data } = await supabase
      .from('audio_uploads')
      .select('account_id')
      .eq('asset_id', assetId)
      .maybeSingle();
    const account = savedAccounts.find(a => a.id === data?.account_id) || selectedAccount;
    if (!account?.apiKey.trim()) return;

    const status = await checkAssetStatus(assetId, account.apiKey);
    await updateAssetStatus(assetId, status);
  };

  const refreshPendingStatuses = async () => {
    if (statusRefreshLockRef.current) return;
    statusRefreshLockRef.current = true;
    try {
      const { data } = await supabase
        .from('audio_uploads')
        .select('asset_id, status, account_id')
        .eq('status', 'Pending');

      if (!data || data.length === 0) return;

      const tasks = data.map(async (row) => {
        const account = savedAccounts.find(a => a.id === row.account_id) || selectedAccount;
        if (!account?.apiKey.trim()) return;
        const status = await checkAssetStatus(row.asset_id, account.apiKey);
        if (status !== 'Pending' && status !== row.status) {
          await updateAssetStatus(row.asset_id, status);
        }
      });

      const CONCURRENCY = 3;
      let nextIndex = 0;
      const worker = async () => {
        while (nextIndex < tasks.length) {
          await tasks[nextIndex++];
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));
    } finally {
      statusRefreshLockRef.current = false;
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND_URL}/api/version`)
      .then(r => r.json())
      .then((info) => { if (!cancelled) setBackendInfo(info); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const refreshPendingResults = async () => {
    const account = selectedAccount;
    if (!account?.apiKey.trim()) return;
    const pending = resultsRef.current.filter(r => r.success && r.assetId && r.status === 'Pending');
    if (pending.length === 0) return;
    for (const r of pending) {
      const status = await checkAssetStatus(r.assetId!, account.apiKey);
      if (status !== 'Pending') {
        setResults(prev => prev.map(x => x.assetId === r.assetId ? { ...x, status } : x));
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadUploadHistory();
      loadSavedAccountsFromDb();
      const interval = setInterval(() => {
        loadUploadHistory();
        refreshPendingStatuses();
        refreshPendingResults();
        refreshAccountQuotas(savedAccountsRef.current);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

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
                      {type === 'youtube' ? (
                        <span className="flex items-center justify-center gap-2">
                          <IconYoutube />
                          Dari YouTube
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <IconUpload />
                          Upload File
                        </span>
                      )}
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
                  className={`${BTN_PRIMARY} mt-4 flex w-full items-center justify-center gap-2`}
                >
                  <IconFile />
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
                              {entry.video?.title || (entry.name || entry.file?.name || 'Audio').replace(/\.[^/.]+$/, '')}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[var(--text-45)]">
                              {entry.video ? `${entry.video.channel} · ${entry.video.durationString}` : (entry.name || entry.file?.name || '')}
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
                  {/* Saved Accounts */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs text-[var(--text-40)]">Akun Roblox</label>
                      <button
                        onClick={() => { setShowAccountSearch(true); setKeyInfo(null); setKeyInfoError(''); setSelectedGroupId(''); }}
                        className="flex items-center gap-1 text-xs text-[var(--accent-soft)] transition-colors hover:text-[var(--accent-strong)]"
                      >
                        <IconPlus />
                        Tambah Akun
                      </button>
                    </div>

                    {savedAccounts.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-xs text-[var(--text-40)]">
                        Belum ada akun tersimpan. Klik <span className="text-[var(--accent-soft)]">+ Tambah Akun</span> untuk menambahkan API key akun Roblox-mu.
                      </div>
                    ) : (
                      <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1">
                        {savedAccounts.map(account => (
                          <button
                            key={`${account.type}-${account.id}`}
                            onClick={() => selectAccount(account)}
                            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.98] ${
                              selectedAccountId === account.id
                                ? 'border-[var(--accent-strong)] bg-[var(--accent-10)] shadow-[0_0_18px_var(--upload-glow)]'
                                : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent-30)]'
                            }`}
                          >
                            {account.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={account.thumbnail}
                                alt={account.name}
                                className="h-10 w-10 shrink-0 rounded-lg object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-strong)] text-[var(--accent-soft)]">
                                {account.type === 'user' ? <IconUser /> : <IconUsers />}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-[var(--text-90)]">
                                {account.displayName && account.displayName !== account.name ? account.displayName : account.name}
                              </div>
                              <div className="truncate text-[11px] text-[var(--text-40)]">
                                {account.type === 'user' ? `@${account.name}` : account.name}
                                {account.memberCount != null && ` · ${account.memberCount.toLocaleString('id-ID')} member`}
                              </div>
                              {account.type === 'group' && account.ownerName && (
                                <div className="truncate text-[10px] text-[var(--accent-soft)]">
                                  milik @{account.ownerName} · menyimpan aset di group ini
                                </div>
                              )}
                              <div className="truncate font-mono text-[10px] text-[var(--text-25)]">
                                {maskApiKey(account.apiKey) || 'belum ada API Key'}
                              </div>
                              <QuotaBar usage={account.audioUsage} capacity={account.audioCapacity} />
                            </div>
                            {selectedAccountId === account.id && (
                              <span className="shrink-0 rounded-full border border-[var(--accent-strong)] bg-[var(--accent-10)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                                Aktif
                              </span>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); removeAccount(account.id); }}
                              className="shrink-0 rounded-lg border border-[var(--line)] p-1.5 text-[var(--text-35)] transition-colors hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-300"
                              title="Hapus akun"
                            >
                              <IconTrash />
                            </button>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
          </div>

          {/* Hasil */}
          <section className={`${CARD} p-6 lg:col-span-2`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--text-60)]">Hasil</h3>
              {results.length > 0 && (
                <button onClick={copyResults} className="text-xs text-[var(--accent-soft)]/80 transition-colors hover:text-[var(--accent-strong)]">
                  Salin
                </button>
              )}
            </div>

            <button
              onClick={uploadToRoblox}
              disabled={uploading || files.length === 0}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-strong)] via-[var(--accent-soft)] to-[var(--accent-deep)] py-3.5 text-sm font-bold text-[var(--on-accent)] shadow-[0_0_30px_var(--upload-glow)] transition-transform duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-[var(--surface-soft)] disabled:via-[var(--surface-soft)] disabled:to-[var(--surface-soft)] disabled:text-[var(--text-40)] disabled:shadow-none disabled:active:scale-100"
            >
              <IconUpload />
              {uploading ? 'Mengupload…' : `Upload ke Roblox (${files.length})`}
            </button>
            <p className="-mt-2 mb-4 text-center text-xs text-[var(--text-35)]">
              {files.length > 0
                ? `${files.length} file → ${selectedAccount ? (selectedAccount.displayName || selectedAccount.name) : 'pilih akun dulu'}`
                : 'Tambahkan file dari kolom Input Audio'}
            </p>

                {(downloadProgress.length === 0 && results.length === 0) ? (
                  <p className="py-8 text-center text-sm text-[var(--text-40)]">Belum ada hasil. Convert link atau upload file dulu.</p>
                ) : (
                  <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
                    {downloadProgress.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-35)]">
                          <span className="h-1 w-1 rounded-full bg-emerald-400" />
                          Converted
                        </div>
                        {downloadProgress.map((item, index) => (
                          <div key={index} className="stagger-enter flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs" style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}>
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              item.status === 'completed' ? 'bg-emerald-400' :
                              item.status === 'failed' ? 'bg-rose-400' : 'animate-pulse bg-[var(--accent-strong)]'
                            }`} />
                            <span className="min-w-0 flex-1 truncate text-[var(--text-70)]">
                              {item.video?.title || item.url}
                            </span>
                            {item.status === 'completed' && (
                              <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                Converted
                              </span>
                            )}
                            {item.status === 'failed' && (
                              <span className="shrink-0 rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                                Gagal
                              </span>
                            )}
                            {item.status !== 'completed' && item.status !== 'failed' && (
                              <span className="shrink-0 animate-pulse text-[10px] font-medium text-[var(--text-40)]">Memproses…</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {results.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-35)]">
                          <span className="h-1 w-1 rounded-full bg-[var(--accent-strong)]" />
                          Upload
                        </div>
                        {results.map((result, index) => (
                          <div
                            key={index}
                            className={`stagger-enter rounded-lg border px-4 py-3 ${
                              result.pending ? 'border-[var(--accent-30)] bg-[var(--accent-10)]' :
                              result.success ? 'border-emerald-400/15 bg-emerald-400/[0.04]' : 'border-rose-400/15 bg-rose-400/[0.04]'
                            }`}
                            style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
                          >
                            {result.pending ? (
                              <>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-70)]">{result.filename}</div>
                                  <span className="shrink-0 animate-pulse rounded-full border border-[var(--accent-30)] bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                                    {result.step === 'moderating' ? 'Moderasi Roblox' : 'Mengunggah…'}
                                  </span>
                                </div>
                                <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-40)]">
                                  <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-[var(--accent-30)] border-t-transparent" />
                                  {result.step === 'moderating'
                                    ? 'Menunggu Roblox memproses audio…'
                                    : 'Mengirim file ke Roblox…'}
                                </div>
                              </>
                            ) : result.success ? (
                              <>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)]">{result.filename}</div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span className="rounded-full border border-[var(--accent-25)] bg-[var(--accent-10)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                                      Uploaded
                                    </span>
                                    <StatusBadge status={result.status || 'Failed'} />
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center gap-2 text-xs">
                                  <span className="text-[var(--text-40)]">ID:</span>
                                  <span className="font-mono text-[var(--text-70)]">{result.assetId}</span>
                                  <button
                                    onClick={() => result.assetId && copyAssetId(result.assetId)}
                                    className="ml-auto text-[var(--accent-soft)]/80 transition-colors hover:text-[var(--accent-strong)]"
                                  >
                                    Copy
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-90)]">{result.filename}</div>
                                  <span className="shrink-0 rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                                    Gagal
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-rose-300/80">{result.error}</div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

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

        {/* Add Account Modal */}
        {showAccountSearch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4" onClick={() => setShowAccountSearch(false)}>
            <div className="modal-enter w-full max-w-md rounded-2xl border border-[var(--accent-25)] bg-[var(--panel)] p-6" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--accent-strong)]">
                  <IconKey />
                  Tambah Akun Roblox
                </h3>
                <button onClick={() => setShowAccountSearch(false)} className="text-[var(--text-40)] transition-colors hover:text-[var(--text)] active:scale-95">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center gap-1.5">
                    <IconKey />
                    <label className="text-xs text-[var(--text-40)]">API Key Roblox</label>
                  </div>
                  <input
                    type="password"
                    value={accountApiKey}
                    onChange={(e) => { setAccountApiKey(e.target.value); setKeyInfo(null); setKeyInfoError(''); setSelectedGroupId(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && checkAccountKey()}
                    placeholder="Tempel API key di sini"
                    className={INPUT}
                  />
                  <p className="mt-1 text-[11px] text-[var(--text-25)]">
                    Cukup tempel API key-nya — pemilik akun & group otomatis dideteksi, kuota audio langsung terlihat.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={checkAccountKey}
                    disabled={keyChecking || !accountApiKey.trim()}
                    className={`${BTN_PRIMARY} flex-1`}
                  >
                    {keyChecking ? 'Mengecek…' : 'Cek'}
                  </button>
                  <button onClick={() => setShowAccountSearch(false)} className={BTN_GHOST}>
                    Batal
                  </button>
                </div>

                {keyInfoError && (
                  <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-300/80">{keyInfoError}</p>
                )}

                {keyInfo && keyInfo.owner && (
                  <div className="rounded-xl border border-[var(--accent-25)] bg-[var(--surface-strong)] p-3">
                    <div className="flex items-center gap-3">
                      {keyInfo.owner.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={keyInfo.owner.thumbnail}
                          alt={keyInfo.owner.name}
                          className="h-12 w-12 shrink-0 rounded-xl object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-lg">👤</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate text-sm font-medium text-[var(--text-90)]">
                          {keyInfo.owner.displayName || keyInfo.owner.name}
                          {keyInfo.owner.hasVerifiedBadge && (
                            <span className="shrink-0 text-[10px] text-[var(--accent-strong)]">
                              <IconCheck />
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[11px] text-[var(--text-40)]">
                          @{keyInfo.owner.name}
                          {keyInfo.keyName && ` · key "${keyInfo.keyName}"`}
                        </div>
                      </div>
                    </div>

                    <QuotaBar usage={keyInfo.audioQuota?.usage ?? undefined} capacity={keyInfo.audioQuota?.capacity ?? undefined} />

                    {keyInfo.groups && keyInfo.groups.length > 0 ? (
                      <div className="mt-3">
                        <p className="mb-1.5 text-[11px] text-[var(--text-35)]">
                          API key ini milik <span className="text-[var(--accent-soft)]">@{keyInfo.owner.name}</span> — upload akan disimpan ke group ini:
                        </p>
                        <div className="space-y-1.5">
                          {keyInfo.groups.map(g => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => setSelectedGroupId(g.id)}
                              className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors active:scale-[0.98] ${
                                selectedGroupId === g.id
                                  ? 'border-[var(--accent-strong)] bg-[var(--accent-10)]'
                                  : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent-30)]'
                              }`}
                            >
                              {g.thumbnail ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={g.thumbnail}
                                  alt={g.name}
                                  className="h-8 w-8 shrink-0 rounded-lg object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-soft)] text-[var(--accent-soft)]">
                                  <IconUsers />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm text-[var(--text-80)]">{g.name}</div>
                                {g.memberCount != null && (
                                  <div className="truncate text-[10px] text-[var(--text-35)]">
                                    {g.memberCount.toLocaleString('id-ID')} member
                                  </div>
                                )}
                              </div>
                              {selectedGroupId === g.id && (
                                <span className="shrink-0 text-[10px] font-semibold text-[var(--accent-strong)]">Dipilih</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-[11px] text-[var(--text-35)]">
                        API key ini milik <span className="text-[var(--accent-soft)]">@{keyInfo.owner.name}</span> — upload akan disimpan ke akun user tersebut.
                      </p>
                    )}

                    <button
                      onClick={addSavedAccount}
                      className="mt-3 w-full rounded-lg bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent-deep)] px-3 py-2.5 text-sm font-semibold text-[var(--on-accent)] transition-transform active:scale-95"
                    >
                      + Simpan Akun
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
          <p className="font-mono text-[10px] text-[var(--text-25)]">
            backend: {backendInfo?.commit ? `#${backendInfo.commit.slice(0, 7)}` : 'offline'}
          </p>
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
