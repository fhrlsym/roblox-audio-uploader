'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Building2, Check, ChevronDown, ChevronLeft, CloudUpload, Music, Plus, Trash2, User, Wand2 } from 'lucide-react';
import { RawAudioFile, TunedAudioFile, SavedAccount, UploadRecord, UploadStats } from '../types/audio';
import InputSection from '../components/InputSection';
import TuningSection from '../components/TuningSection';
import OutputSection from '../components/OutputSection';
import AccountModal from '../components/AccountModal';
import UploadHistory from '../components/UploadHistory';
import { ToastProvider } from '../components/Toast';
import { CARD, PANEL, LABEL, BTN_PRIMARY } from '../lib/ui';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const CORRECT_PIN = process.env.NEXT_PUBLIC_PIN || '515753';
const SETTINGS_KEY = 'audioUploader_settings';

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function Home() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [theme, setTheme] = useState('gold-dark');
  const [themeOpen, setThemeOpen] = useState(false);
  const [youtubeCookies, setYoutubeCookies] = useState('');
  const [activeStep, setActiveStep] = useState(1);

  const goToStep = (step: number) => {
    setActiveStep(step);
  };

  const [rawFiles, setRawFiles] = useState<RawAudioFile[]>([]);
  const [tunedFiles, setTunedFiles] = useState<TunedAudioFile[]>([]);

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);
  const [uploadStats, setUploadStats] = useState<UploadStats>({ total: 0, active: 0, pending: 0, failed: 0, copyright: 0 });
  const [refreshingIds, setRefreshingIds] = useState<string[]>([]);
  const statusRefreshLockRef = useRef(false);
  const selectedAccountRef = useRef<SavedAccount | null>(null);
  const accountsRef = useRef<SavedAccount[]>([]);

  const loadSavedAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const apiKeys = JSON.parse(localStorage.getItem('audioUploader_apiKeys') || '{}');

        const accounts: SavedAccount[] = data.map((row) => ({
          id: row.id,
          name: row.display_name || row.name,
          type: row.type,
          apiKey: row.api_key || apiKeys[row.id] || '',
          userId: row.owner_id,
          groupId: row.type === 'group' ? row.id : undefined,
          displayName: row.display_name || undefined,
          memberCount: row.member_count ?? undefined,
          hasVerifiedBadge: !!row.has_verified_badge,
          thumbnail: row.thumbnail || null,
          ownerName: row.owner_name || null,
          quota: row.audio_usage != null && row.audio_capacity != null ? {
            usage: row.audio_usage,
            capacity: row.audio_capacity,
            period: 'MONTH',
          } : null,
        }));
        setSavedAccounts(accounts);
        if (accounts.length > 0) {
          const savedAccId = localStorage.getItem('audioUploader_selectedAccountId');
          setSelectedAccount((prev) => {
            if (prev && accounts.some((a) => a.id === prev.id)) return prev;
            if (savedAccId) {
              const matched = accounts.find((a) => a.id === savedAccId);
              if (matched) return matched;
            }
            return accounts[0];
          });
        } else {
          setSelectedAccount(null);
        }
      }
    } catch {
      // ignore
    }
  };

  const loadUploadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('audio_uploads')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        const history: UploadRecord[] = data.map((row) => ({
          id: row.id,
          fileName: row.name,
          displayName: row.name,
          assetId: row.asset_id,
          accountId: row.account_id || '',
          accountName: 'Roblox',
          uploadedAt: new Date(row.uploaded_at).getTime(),
          status: row.status || 'Pending',
        }));
        setUploadHistory(history);
        setUploadStats({
          total: data.length,
          active: data.filter((d) => d.status === 'Active').length,
          pending: data.filter((d) => d.status === 'Pending').length,
          failed: data.filter((d) => d.status === 'Failed').length,
          copyright: data.filter((d) => d.status === 'Copyright').length,
        });
      }
    } catch {
      // ignore
    }
  };

  const refreshAccountQuotas = async () => {
    const withKey = accountsRef.current.filter((a) => a.apiKey.trim());
    if (withKey.length === 0) return;
    const results = await Promise.all(
      withKey.map(async (a) => {
        try {
          const response = await fetch(`${BACKEND_URL}/api/roblox/key-info?apiKey=${encodeURIComponent(a.apiKey)}`);
          const data = await response.json();
          if (!response.ok || !data.owner) return null;
          return {
            id: a.id,
            usage: data.audioQuota?.usage ?? null,
            capacity: data.audioQuota?.capacity ?? null,
          };
        } catch {
          return null;
        }
      })
    );
    const updates = results.filter((r): r is NonNullable<typeof r> => r !== null);
    if (updates.length === 0) return;
    setSavedAccounts((prev) =>
      prev.map((a) => {
        const upd = updates.find((u) => u.id === a.id);
        return upd ? { ...a, quota: upd.usage != null && upd.capacity != null ? { usage: upd.usage, capacity: upd.capacity } : a.quota } : a;
      })
    );
  };

  const handleAccountAdded = async (account: SavedAccount) => {
    try {
      const { error } = await supabase
        .from('saved_accounts')
        .upsert(
          {
            id: account.id,
            type: account.type,
            name: account.name,
            display_name: account.displayName || account.name,
            member_count: account.memberCount || 0,
            has_verified_badge: account.hasVerifiedBadge || false,
            thumbnail: account.thumbnail || null,
            owner_id: account.userId,
            owner_name: account.ownerName || null,
            audio_usage: account.quota?.usage || null,
            audio_capacity: account.quota?.capacity || null,
            api_key: account.apiKey,
          },
          { onConflict: 'id,type' }
        )
        .select()
        .single();

      if (!error) {
        const apiKeys = JSON.parse(localStorage.getItem('audioUploader_apiKeys') || '{}');
        apiKeys[account.id] = account.apiKey;
        localStorage.setItem('audioUploader_apiKeys', JSON.stringify(apiKeys));
        await loadSavedAccounts();
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      await supabase.from('saved_accounts').delete().eq('id', accountId);
      const apiKeys = JSON.parse(localStorage.getItem('audioUploader_apiKeys') || '{}');
      delete apiKeys[accountId];
      localStorage.setItem('audioUploader_apiKeys', JSON.stringify(apiKeys));
      if (selectedAccountRef.current?.id === accountId) setSelectedAccount(null);
      await loadSavedAccounts();
    } catch {
      // ignore
    }
  };

  const checkAssetStatus = async (assetId: string, apiKey: string): Promise<string> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/asset-status/${assetId}?apiKey=${encodeURIComponent(apiKey)}`);
      const data = await response.json();
      if (data.moderationResult && data.moderationResult.moderationState === 'Rejected') return 'Copyright';
      if (data.status) return data.status;
      if (data.state === 'Active') return 'Active';
      if (data.state === 'Pending') return 'Pending';
      return 'Failed';
    } catch {
      return 'Pending';
    }
  };

  const updateAssetStatus = async (assetId: string, status: string) => {
    await supabase
      .from('audio_uploads')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('asset_id', assetId);
    await loadUploadHistory();
  };

  const handleRefreshStatus = async (assetId: string) => {
    const row = uploadHistory.find((h) => h.assetId === assetId);
    const account = savedAccounts.find((a) => a.id === row?.accountId) || selectedAccountRef.current;
    if (!account?.apiKey.trim()) return;
    setRefreshingIds((prev) => [...prev, assetId]);
    try {
      const status = await checkAssetStatus(assetId, account.apiKey);
      await updateAssetStatus(assetId, status);
    } finally {
      setRefreshingIds((prev) => prev.filter((id) => id !== assetId));
    }
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
        const account = savedAccounts.find((a) => a.id === row.account_id) || selectedAccountRef.current;
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

  const handleUploadSuccess = async (record: UploadRecord) => {
    try {
      await supabase.from('audio_uploads').insert({
        asset_id: record.assetId,
        name: record.fileName,
        status: record.status || 'Pending',
        original_speed: 1,
        amplify: 0,
        roblox_playback_speed: 1,
        account_id: selectedAccountRef.current?.id || null,
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await loadUploadHistory();
    } catch {
      // ignore
    }
  };

  const handleClearHistory = async () => {
    try {
      await supabase.from('audio_uploads').delete().neq('id', '');
      setUploadHistory([]);
      setUploadStats({ total: 0, active: 0, pending: 0, failed: 0, copyright: 0 });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const isUnlocked = localStorage.getItem('audioUploader_unlocked') === 'true';
    if (isUnlocked) {
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setTheme(data.theme || 'gold-dark');
        setYoutubeCookies(data.youtubeCookies || '');
      } catch {
        // ignore
      }
    }
    if (unlocked) {
      loadSavedAccounts();
      loadUploadHistory();
    }
  }, [unlocked]);

  useEffect(() => {
    if (unlocked) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme, youtubeCookies }));
    }
  }, [theme, youtubeCookies, unlocked]);

  useEffect(() => {
    accountsRef.current = savedAccounts;
  }, [savedAccounts]);

  useEffect(() => {
    selectedAccountRef.current = selectedAccount;
    if (selectedAccount) {
      localStorage.setItem('audioUploader_selectedAccountId', selectedAccount.id);
    }
  }, [selectedAccount]);

  useEffect(() => {
    if (!unlocked) return;
    loadUploadHistory();
    loadSavedAccounts();
    refreshAccountQuotas();
    const interval = setInterval(() => {
      loadUploadHistory();
      refreshPendingStatuses();
      refreshAccountQuotas();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      setUnlocked(true);
      localStorage.setItem('audioUploader_unlocked', 'true');
      setPin('');
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
    }
  };

  const stats = [
    { label: 'Total', value: uploadStats.total },
    { label: 'Active', value: uploadStats.active },
    { label: 'Pending', value: uploadStats.pending },
    { label: 'Copyright', value: uploadStats.copyright },
  ];

  const steps = [
    { id: 1, label: 'Input Audio', icon: Music, count: rawFiles.length, sub: 'Convert MP3' },
    { id: 2, label: 'Audio Tuning', icon: Wand2, count: tunedFiles.length, sub: 'Speed & Amplify' },
    { id: 3, label: 'Output & Upload', icon: CloudUpload, count: 0, sub: 'Upload ke Roblox' },
  ];

  if (!unlocked) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-[42rem] rounded-full bg-[var(--accent)] opacity-10 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-[var(--accent)] opacity-[0.06] blur-[100px]" />
        <div className="modal-enter relative w-full max-w-md rounded-2xl border border-[var(--accent-15)] bg-[var(--panel)] p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              <span className="bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent-deep)] bg-clip-text text-transparent">
                S2 Studio
              </span>
            </h1>
            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-[var(--text-40)]">
              Audio Master to Roblox
            </p>
          </div>
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              autoFocus
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-center text-2xl tracking-[0.5em] text-[var(--text)] outline-none transition focus:border-[var(--accent-50)]"
            />
            {pinError && (
              <p className="text-center text-xs text-rose-300">PIN salah, coba lagi.</p>
            )}
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent-deep)] py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:brightness-110 active:scale-[0.98]"
            >
              Unlock
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-[var(--text-35)]">Created by fhrlsym</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div data-theme={theme} className="relative min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans selection:bg-[var(--accent-20)] selection:text-[var(--accent-strong)]">
        {/* Background Ambient Glows */}
        <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 h-96 w-[60rem] rounded-full bg-[var(--glow-1)] blur-[140px]" />
        <div className="pointer-events-none fixed bottom-0 -left-20 h-80 w-80 rounded-full bg-[var(--glow-2)] blur-[120px]" />
        <div className="pointer-events-none fixed bottom-10 right-0 h-64 w-64 rounded-full bg-[var(--glow-3)] blur-[110px]" />

        {/* Floating Command Hub Container */}
        <div className="relative mx-auto max-w-3xl px-4 py-8 sm:py-12">
          {/* Main Floating Glass Hub */}
          <div className="relative rounded-3xl border border-[var(--accent-15)] bg-[var(--panel)] p-6 sm:p-8 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_at_top_right,var(--accent-10),transparent_60%)]" />

            {/* Topbar: Header & Controls */}
            <div className="relative mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-[var(--accent-strong)] animate-pulse" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--accent-soft)]">
                    S2 Studio
                  </p>
                </div>
                <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                  Audio Master{' '}
                  <span className="bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent-deep)] bg-clip-text text-transparent">
                    to Roblox
                  </span>
                </h1>
              </div>

              {/* Topbar Actions: Account Pill & Theme Dropdown */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Account Selector Pill */}
                {selectedAccount ? (
                  <button
                    onClick={() => setShowAccountModal(true)}
                    className="flex items-center gap-2.5 rounded-2xl border border-[var(--accent-25)] bg-[var(--accent-10)] px-3 py-1.5 text-xs text-[var(--text-90)] transition hover:border-[var(--accent-50)] active:scale-[0.98]"
                    title="Ganti atau kelola akun Roblox"
                  >
                    {selectedAccount.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedAccount.thumbnail}
                        alt={selectedAccount.name}
                        className="h-6 w-6 rounded-full border border-[var(--accent-30)] object-cover"
                      />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-20)]">
                        {selectedAccount.type === 'group' ? (
                          <Building2 className="w-3 h-3 text-[var(--accent-strong)]" />
                        ) : (
                          <User className="w-3 h-3 text-[var(--accent-strong)]" />
                        )}
                      </div>
                    )}
                    <span className="max-w-[110px] truncate font-medium">{selectedAccount.name}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--text-40)]" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAccountModal(true)}
                    className="flex items-center gap-1.5 rounded-2xl border border-dashed border-[var(--accent-30)] bg-[var(--accent-06)] px-3 py-1.5 text-xs font-medium text-[var(--accent-soft)] transition hover:bg-[var(--accent-10)]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Akun
                  </button>
                )}

                {/* Theme Selector Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setThemeOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-80)] transition hover:border-[var(--accent-30)]"
                  >
                    <span className="h-3 w-3 rounded-full" style={{ background: THEMES.find((t) => t.id === theme)?.swatch }} />
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--text-40)]" />
                  </button>
                  {themeOpen && (
                    <div className="modal-enter absolute right-0 z-40 mt-2 w-44 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-2xl backdrop-blur-xl">
                      {THEMES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setTheme(t.id);
                            setThemeOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition ${
                            theme === t.id ? 'bg-[var(--accent-10)] text-[var(--accent-strong)] font-semibold' : 'text-[var(--text-70)] hover:bg-[var(--surface)]'
                          }`}
                        >
                          <span className="h-3 w-3 rounded-full" style={{ background: t.swatch }} />
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Analytics Counters */}
            <div className="mb-6 grid grid-cols-4 gap-2 text-center">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
                  <div className="text-xl font-bold tabular-nums text-[var(--text)]">{stat.value}</div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--text-40)]">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Capsule Segmented Stepper */}
            <div className="relative mb-6 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-1.5 overflow-x-auto">
              <div className="grid grid-cols-3 gap-1 min-w-[340px]">
                {steps.map((step) => {
                  const isActive = activeStep === step.id;
                  return (
                    <button
                      key={step.id}
                      onClick={() => goToStep(step.id)}
                      className={`relative flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl py-2.5 px-2 sm:px-3 text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent-deep)] text-[var(--on-accent)] shadow-md'
                          : 'text-[var(--text-60)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      <step.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="truncate">{step.label}</span>
                      {step.count > 0 && (
                        <span className={`inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                          isActive ? 'bg-[var(--on-accent)] text-[var(--accent-dark)]' : 'bg-[var(--accent-strong)] text-[var(--on-accent)]'
                        }`}>
                          {step.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* YouTube Cookies Option (Collapsible) */}
            <details className="group mb-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] transition">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-xs font-medium text-[var(--text-70)] hover:text-[var(--text)]">
                <span>YouTube Cookies (Opsional untuk video bertanda login)</span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-40)] transition group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4 pt-1">
                <textarea
                  value={youtubeCookies}
                  onChange={(e) => setYoutubeCookies(e.target.value)}
                  placeholder="Paste Netscape cookies format..."
                  rows={2}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 font-mono text-xs text-[var(--text)] outline-none transition focus:border-[var(--accent-40)]"
                />
              </div>
            </details>

            {/* Active Workbench Section */}
            <div className="relative">
              <div className={activeStep === 1 ? 'stagger-enter' : 'hidden'}>
                <InputSection
                  onFilesAdded={(files) => setRawFiles((prev) => [...prev, ...files])}
                  backendUrl={BACKEND_URL}
                  youtubeCookies={youtubeCookies}
                  onYoutubeCookiesChange={setYoutubeCookies}
                  onNext={() => goToStep(2)}
                />
              </div>

              <div className={activeStep === 2 ? 'stagger-enter' : 'hidden'}>
                {rawFiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--line)] p-8 text-center">
                    <Wand2 className="mx-auto mb-3 h-8 w-8 text-[var(--text-30)]" />
                    <p className="text-sm font-medium text-[var(--text-70)]">Belum ada file audio untuk di-tune.</p>
                    <p className="mt-1 text-xs text-[var(--text-40)]">Tambahkan link YouTube atau upload file di Langkah 1.</p>
                    <button onClick={() => goToStep(1)} className={BTN_PRIMARY + ' mt-4'}>
                      <ChevronLeft className="w-4 h-4" />
                      Kembali ke Langkah 1
                    </button>
                  </div>
                ) : (
                  <TuningSection
                    rawFiles={rawFiles}
                    onTuningComplete={(tuned) => setTunedFiles((prev) => [...prev, ...tuned])}
                    onRemoveRaw={(id) => setRawFiles((prev) => prev.filter((f) => f.id !== id))}
                    onNext={() => goToStep(3)}
                  />
                )}
              </div>

              <div className={activeStep === 3 ? 'stagger-enter' : 'hidden'}>
                {tunedFiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--line)] p-8 text-center">
                    <CloudUpload className="mx-auto mb-3 h-8 w-8 text-[var(--text-30)]" />
                    <p className="text-sm font-medium text-[var(--text-70)]">Belum ada file hasil tuning untuk di-upload.</p>
                    <p className="mt-1 text-xs text-[var(--text-40)]">Proses tuning file Anda di Langkah 2 dulu.</p>
                    <button onClick={() => goToStep(2)} className={BTN_PRIMARY + ' mt-4'}>
                      <ChevronLeft className="w-4 h-4" />
                      Kembali ke Langkah 2
                    </button>
                  </div>
                ) : (
                  <OutputSection
                    tunedFiles={tunedFiles}
                    onRemoveTuned={(id) => setTunedFiles((prev) => prev.filter((f) => f.id !== id))}
                    backendUrl={BACKEND_URL}
                    selectedAccount={selectedAccount}
                    onUploadSuccess={handleUploadSuccess}
                  />
                )}
              </div>
            </div>

            {/* Upload History Section */}
            <div className="mt-6">
              <UploadHistory
                history={uploadHistory}
                onClear={handleClearHistory}
                onRefresh={handleRefreshStatus}
                refreshingIds={refreshingIds}
              />
            </div>

            {/* Footer */}
            <footer className="mt-6 text-center text-xs text-[var(--text-35)]">
              <p>S2 Studio · Audio Master to Roblox</p>
            </footer>
          </div>
        </div>

        {/* Account Modal */}
        <AccountModal
          isOpen={showAccountModal}
          onClose={() => setShowAccountModal(false)}
          onAccountAdded={handleAccountAdded}
          backendUrl={BACKEND_URL}
        />
      </div>
    </ToastProvider>
  );
}
