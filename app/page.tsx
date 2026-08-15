'use client';

import { useState, useEffect, Fragment } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Check, ChevronDown, CloudUpload, History as HistoryIcon, Lock, Music, Plus, Trash2, User, Wand2 } from 'lucide-react';
import InputSection from '../components/InputSection';
import TuningSection from '../components/TuningSection';
import OutputSection from '../components/OutputSection';
import SpooferSection from '../components/SpooferSection';
import DumperSection from '../components/DumperSection';
import ObfuscatorSection from '../components/ObfuscatorSection';
import AccountModal from '../components/AccountModal';
import UploadHistory from '../components/UploadHistory';
import VersionChecker from '../components/VersionChecker';
import GitHubExportModal, { GitHubIcon } from '../components/GitHubExportModal';
import { ToastProvider } from '../components/Toast';
import { CARD, BTN_PRIMARY, cleanSongTitle } from '../lib/ui';
import { useSavedAccounts } from '../hooks/useSavedAccounts';
import { useUploadHistory } from '../hooks/useUploadHistory';
import { useAudioQueue } from '../hooks/useAudioQueue';
import { Sparkles, Terminal } from 'lucide-react';

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
  { id: 'violet', label: 'Violet', swatch: 'linear-gradient(135deg, #c4b5fd, #53389e)' },
  { id: 'rose', label: 'Rose', swatch: 'linear-gradient(135deg, #f9a8d4, #932e64)' },
  { id: 'graphite', label: 'Graphite', swatch: 'linear-gradient(135deg, #cbd5e1, #465368)' },
  { id: 'cyber', label: 'Cyber', swatch: 'linear-gradient(135deg, #67e8f9, #0e7490)' },
  { id: 'light-ocean', label: 'Light Ocean', swatch: 'linear-gradient(135deg, #dbeafe, #0284c7)' },
  { id: 'light-rose', label: 'Light Rose', swatch: 'linear-gradient(135deg, #fbcfe8, #db2777)' },
];

export default function Home() {
  const [activeTool, setActiveTool] = useState<'audio-master' | 'spoofer' | 'dumper' | 'obfuscator'>('audio-master');
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [theme, setTheme] = useState('gold-dark');
  const [themeOpen, setThemeOpen] = useState(false);
  const [youtubeCookies, setYoutubeCookies] = useState('');
  const [webVersion, setWebVersion] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [githubModalOpen, setGithubModalOpen] = useState(false);

  useEffect(() => {
    const loadVersion = async () => {
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version) setWebVersion(data.version);
      } catch {
        // ignore
      }
    };
    loadVersion();
  }, []);

  // Clean Modular Custom Hooks
  const {
    savedAccounts,
    selectedAccount,
    showAccountModal,
    setShowAccountModal,
    accountMenuOpen,
    setAccountMenuOpen,
    selectedAccountRef,
    refreshAccountQuotas,
    handleAccountAdded,
    handleDeleteAccount,
    selectAccount,
  } = useSavedAccounts(unlocked, BACKEND_URL);

  const {
    uploadHistory,
    uploadStats,
    setKnownAccounts,
    refreshingIds,
    handleRefreshStatus,
    refreshPendingStatuses,
    handleUploadSuccess,
  } = useUploadHistory(unlocked, BACKEND_URL, selectedAccountRef);

  useEffect(() => {
    setKnownAccounts(savedAccounts);
  }, [savedAccounts, setKnownAccounts]);

  const {
    rawFiles,
    tunedFiles,
    activeStep,
    addRawFiles,
    removeRawFile,
    addTunedFiles,
    removeTunedFile,
    goToStep,
  } = useAudioQueue();

  useEffect(() => {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (settings.theme) setTheme(settings.theme);
    if (settings.youtubeCookies) setYoutubeCookies(settings.youtubeCookies);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Periodic quota & status refresh
  useEffect(() => {
    if (!unlocked) return;
    const quotaTimer = setInterval(refreshAccountQuotas, 60000);
    const statusTimer = setInterval(refreshPendingStatuses, 5000);

    return () => {
      clearInterval(quotaTimer);
      clearInterval(statusTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      setUnlocked(true);
    } else {
      setPinError(true);
      setPin('');
    }
  };

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    setThemeOpen(false);
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      settings.theme = newTheme;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  };

  const handleYoutubeCookiesChange = (cookies: string) => {
    setYoutubeCookies(cookies);
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      settings.youtubeCookies = cookies;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.relative')) {
        setAccountMenuOpen(false);
        setThemeOpen(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [setAccountMenuOpen]);

  const toggleAccountMenu = () => {
    setAccountMenuOpen((prev) => {
      if (!prev) setThemeOpen(false);
      return !prev;
    });
  };

  const toggleThemeMenu = () => {
    setThemeOpen((prev) => {
      if (!prev) setAccountMenuOpen(false);
      return !prev;
    });
  };

  if (!unlocked) {
    return (
      <ToastProvider>
        <div className="relative min-h-screen flex items-center justify-center bg-[var(--bg)] p-4 overflow-hidden">
          {/* Ambient Accent Glow */}
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-[120px]"
            style={{ background: 'var(--accent-soft)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, var(--text) 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="relative w-full max-w-sm"
          >
            <div className={`${CARD} p-7 space-y-6 text-center shadow-2xl border border-[var(--line)] bg-[var(--panel)] backdrop-blur-xl`}>
              {/* Logo — centered container */}
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 16 }}
                className="flex flex-col items-center justify-center"
              >
                <div className="relative inline-block">
                  <img
                    src="/icon.svg"
                    alt="S2 Studio"
                    className="h-16 w-16 rounded-2xl shadow-xl border border-[var(--line)] object-cover"
                  />
                  <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--bg)] bg-[var(--emerald)] shadow-md">
                    <Check className="w-3.5 h-3.5 text-[#000000] stroke-[3]" />
                  </span>
                </div>
              </motion.div>

              <div>
                <h1 className="font-serif text-2xl font-bold tracking-tight text-[var(--text)]">S2 Studio</h1>
                <p className="text-xs font-medium text-[var(--text-50)] mt-1">Audio Master &amp; Asset Spoofer</p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-20)] bg-[var(--accent-10)] px-3 py-1 text-[11px] font-semibold text-[var(--accent-strong)] shadow-sm">
                  <Sparkles className="w-3 h-3" />
                  Akses Terproteksi
                </span>
              </div>

              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div className="space-y-2">
                  <p className={`text-xs font-medium transition ${pinError ? 'text-[var(--danger)]' : 'text-[var(--text-40)]'}`}>
                    {pinError ? 'PIN salah, coba lagi.' : 'Masukkan PIN untuk melanjutkan'}
                  </p>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]*"
                    value={pin}
                    onChange={(e) => {
                      const onlyDigits = e.target.value.replace(/\D/g, '');
                      setPin(onlyDigits.slice(0, 6));
                      setPinError(false);
                    }}
                    placeholder="••••••"
                    autoFocus
                    className="w-full text-center text-3xl tracking-[0.6em] py-3 bg-[var(--surface-focus)] border border-[var(--line)] rounded-xl text-[var(--text)] focus:outline-none focus:border-[var(--accent-40)] focus:ring-1 focus:ring-[var(--accent-30)] placeholder:text-[var(--text-30)] transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={pin.length < 1}
                  className={`${BTN_PRIMARY} w-full py-3 text-sm font-semibold`}
                >
                  <Lock className="w-4 h-4" />
                  Buka Akses
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-[11px] text-[var(--text-35)]">
              Created &amp; developed by fhrlsym
            </p>
          </motion.div>
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <VersionChecker />
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
        {/* Header Navigation */}
        <header className="sticky top-0 z-40 border-b border-[var(--line)] backdrop-blur-xl bg-opacity-90 header-glass">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--accent-15)] flex items-center justify-center text-[var(--accent)] shrink-0">
                  <Music className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h1 className="font-bold text-xs sm:text-sm leading-none text-[var(--text)]">S2 Studio</h1>
                  <p className="text-[10px] sm:text-[11px] text-[var(--text-45)] font-medium mt-0.5 max-w-[90px] sm:w-[150px] truncate">
                    {activeTool === 'audio-master' ? 'Audio Master' : activeTool === 'obfuscator' ? 'Obfuscator' : 'Spoofer'}
                  </p>
                </div>
              </div>

              {/* Desktop Tool Switcher */}
              <div className="hidden sm:flex items-center gap-1 p-1 bg-[var(--surface-50)] rounded-2xl border border-[var(--line)] ml-4 shrink-0">
                <button
                  onClick={() => setActiveTool('audio-master')}
                  className={`flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTool === 'audio-master' ? 'bg-[var(--accent)] text-[#000000] shadow-sm' : 'text-[var(--text-60)] hover:text-[var(--text)]'
                  }`}
                >
                  <Music className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Audio Master</span>
                </button>
                <button
                  onClick={() => setActiveTool('spoofer')}
                  className={`flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTool === 'spoofer' ? 'bg-[var(--accent)] text-[#000000] shadow-sm' : 'text-[var(--text-60)] hover:text-[var(--text)]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Spoofer</span>
                </button>
                <button
                  onClick={() => setActiveTool('dumper')}
                  className={`flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTool === 'dumper' ? 'bg-[var(--accent)] text-[#000000] shadow-sm' : 'text-[var(--text-60)] hover:text-[var(--text)]'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Dumper</span>
                </button>
                <button
                  onClick={() => setActiveTool('obfuscator')}
                  className={`flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTool === 'obfuscator' ? 'bg-[var(--accent)] text-[#000000] shadow-sm' : 'text-[var(--text-60)] hover:text-[var(--text)]'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Obfuscator</span>
                </button>
              </div>

              {/* Header Right Actions (Account Dropdown + Theme Picker) */}
              <div className="flex items-center gap-2">
                {/* Account Dropdown */}
                <div className="relative">
                  <button
                    onClick={toggleAccountMenu}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] hover:bg-[var(--surface)] text-xs transition max-w-[130px] sm:max-w-none"
                  >
                    {selectedAccount ? (
                      <>
                        {selectedAccount.thumbnail ? (
                          <img
                            src={selectedAccount.thumbnail}
                            alt={selectedAccount.name}
                            referrerPolicy="no-referrer"
                            className="h-4.5 w-4.5 sm:h-5 sm:w-5 rounded-md object-cover border border-[var(--line)] shrink-0"
                          />
                        ) : selectedAccount.type === 'group' ? (
                          <Building2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                        )}
                        <span className="font-semibold text-[11px] sm:text-xs truncate">{selectedAccount.name}</span>
                      </>
                    ) : (
                      <span className="text-[var(--text-45)] text-[11px] sm:text-xs">Pilih Akun</span>
                    )}
                    <ChevronDown className="w-3 h-3 text-[var(--text-45)] shrink-0 ml-0.5" />
                  </button>

                  <AnimatePresence>
                    {accountMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -6 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="fixed left-3 right-3 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-72 max-w-[320px] mx-auto sm:mx-0 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-2xl z-50 space-y-2 max-h-[75vh] overflow-y-auto"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-40)] px-1">
                          Pilih Akun Roblox Target
                        </p>
                        {savedAccounts.map((acc) => {
                          const hasQuota = acc.quota != null && acc.quota.capacity > 0;
                          const qUsage = acc.quota?.usage ?? 0;
                          const qCap = acc.quota?.capacity ?? 1;
                          const qPct = Math.min(100, (qUsage / qCap) * 100);
                          const qColor = qPct >= 90 ? 'bg-rose-400' : qPct >= 70 ? 'bg-amber-400' : 'bg-emerald-400';

                          return (
                            <div
                              key={acc.id}
                              onClick={() => selectAccount(acc)}
                              className={`group flex w-full flex-col rounded-xl border p-2.5 transition cursor-pointer ${
                                selectedAccount?.id === acc.id
                                  ? 'border-[var(--accent-30)] bg-[var(--accent-10)]'
                                  : 'border-[var(--line)] bg-[var(--surface-50)] hover:border-[var(--accent-25)] hover:bg-[var(--surface)]'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                {acc.thumbnail ? (
                                  <img
                                    src={acc.thumbnail}
                                    alt={acc.name}
                                    className="h-10 w-10 rounded-lg object-cover border border-[var(--line)] shrink-0"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-50)] text-[var(--text-40)]">
                                    {acc.type === 'group' ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="min-w-0 flex-1 text-xs font-semibold text-[var(--text-90)] leading-snug break-words">
                                      {acc.name}
                                    </p>
                                    {acc.type === 'group' ? (
                                      <Building2 className="w-3 h-3 shrink-0 text-[var(--accent-soft)]" />
                                    ) : (
                                      <User className="w-3 h-3 shrink-0 text-[var(--accent-soft)]" />
                                    )}
                                  </div>
                                  {acc.type === 'group' ? (
                                    <p className="mt-0.5 text-[10px] text-[var(--text-40)] font-normal break-words">
                                      Komunitas · {acc.memberCount != null ? acc.memberCount.toLocaleString() + ' member' : 'Group Roblox'}
                                    </p>
                                  ) : (
                                    <p className="mt-0.5 text-[10px] text-[var(--text-40)] font-normal break-words">
                                      Akun User
                                    </p>
                                  )}
                                  {acc.type === 'group' && (
                                    <p className="text-[10px] text-[var(--accent-soft)]">Upload masuk ke komunitas ini</p>
                                  )}
                                  {hasQuota && (
                                    <div className="mt-2">
                                      <div className="flex items-center justify-between text-[10px] text-[var(--text-40)]">
                                        <span>Kuota key owner</span>
                                        <span className="font-medium text-[var(--text-60)]">
                                          {acc.quota!.usage.toLocaleString()} / {acc.quota!.capacity.toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--surface-strong)] overflow-hidden">
                                        <div className={`h-full ${qColor} transition-all duration-300`} style={{ width: `${qPct}%` }} />
                                      </div>
                                    </div>
                                  )}
                                  {acc.ownerName && (
                                    <p className="mt-1.5 text-[10px] text-[var(--text-35)] break-words">
                                      Ditambahkan melalui akun @{acc.ownerName}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <div>
                                  {acc.createdAt != null && (
                                    <span className="text-[10px] text-[var(--text-35)]">
                                      {new Date(acc.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {selectedAccount?.id === acc.id && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--emerald)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#000000]">
                                      <span className="w-1 h-1 rounded-full bg-[#000000]" />
                                      Active
                                    </span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteAccount(acc.id);
                                    }}
                                    className="p-1 hover:text-[var(--danger)] text-[var(--text-30)] transition"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        <div className="pt-2 border-t border-[var(--line)] space-y-1">
                          <button
                            onClick={() => {
                              setAccountMenuOpen(false);
                              setShowAccountModal(true);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[var(--accent-soft)] hover:bg-[var(--accent-10)] transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Tambah Akun Baru
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Theme Picker */}
                <div className="relative">
                  <button
                    onClick={toggleThemeMenu}
                    className="w-8 h-8 rounded-xl border border-[var(--line)] flex items-center justify-center hover:bg-[var(--surface-50)] transition"
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-[var(--line)]"
                      style={{ background: THEMES.find((t) => t.id === theme)?.swatch }}
                    />
                  </button>

                  <AnimatePresence>
                    {themeOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -6 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="fixed right-3 top-14 sm:absolute sm:right-0 sm:top-full sm:mt-2 w-44 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-2xl z-50 space-y-0.5 max-h-[70vh] overflow-y-auto"
                      >
                        {THEMES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => changeTheme(t.id)}
                            className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[11px] font-medium transition ${
                              theme === t.id ? 'bg-[var(--accent-15)] text-[var(--accent-strong)]' : 'hover:bg-[var(--surface)] text-[var(--text-70)]'
                            }`}
                          >
                            <span className="h-3.5 w-3.5 rounded-full shrink-0 border border-[var(--line)]" style={{ background: t.swatch }} />
                            <span className="whitespace-nowrap">{t.label}</span>
                            {theme === t.id && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Mobile Tool Switcher Bar */}
            <div className="flex sm:hidden items-center justify-center gap-1 p-1 bg-[var(--surface-50)] rounded-xl border border-[var(--line)] w-full mb-1">
              <button
                onClick={() => setActiveTool('audio-master')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTool === 'audio-master' ? 'bg-[var(--accent)] text-[#000000] shadow-sm' : 'text-[var(--text-60)] hover:text-[var(--text)]'
                }`}
              >
                <Music className="w-3.5 h-3.5 shrink-0" />
                <span>Audio</span>
              </button>
              <button
                onClick={() => setActiveTool('spoofer')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTool === 'spoofer' ? 'bg-[var(--accent)] text-[#000000] shadow-sm' : 'text-[var(--text-60)] hover:text-[var(--text)]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Spoofer</span>
              </button>
              <button
                onClick={() => setActiveTool('dumper')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTool === 'dumper' ? 'bg-[var(--accent)] text-[#000000] shadow-sm' : 'text-[var(--text-60)] hover:text-[var(--text)]'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 shrink-0" />
                <span>Dumper</span>
              </button>
              <button
                onClick={() => setActiveTool('obfuscator')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTool === 'obfuscator' ? 'bg-[var(--accent)] text-[#000000] shadow-sm' : 'text-[var(--text-60)] hover:text-[var(--text)]'
                }`}
              >
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Obfuscator</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Application Workbench */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          {/* Audio Master Tool (selalu ter-mount agar state tidak reset) */}
          <div className={activeTool === 'audio-master' ? 'space-y-6' : 'hidden'}>
            {/* Top Overview & Stats Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 flex-1">
                <div className={`${CARD} p-3 sm:p-4 text-center relative overflow-hidden`}>
                  <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--accent-40)] via-[var(--accent)] to-[var(--accent-40)] shimmer-bar" />
                  <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider inline-flex items-center gap-1 sm:gap-1.5 text-[var(--text-45)]">
                    <CloudUpload className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--accent-soft)]" />
                    Total
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-[var(--text)] mt-0.5 sm:mt-1">{uploadStats.total}</p>
                </div>
                <div className={`${CARD} p-3 sm:p-4 text-center relative overflow-hidden`}>
                  <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 shimmer-bar" />
                  <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider inline-flex items-center gap-1 sm:gap-1.5 text-[var(--text-45)]">
                    <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--emerald)]" />
                    Success
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-[var(--emerald)] mt-0.5 sm:mt-1">{uploadStats.active}</p>
                </div>
                <div className={`${CARD} p-3 sm:p-4 text-center relative overflow-hidden`}>
                  <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-400 via-rose-500 to-rose-400 shimmer-bar" />
                  <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider inline-flex items-center gap-1 sm:gap-1.5 text-[var(--text-45)]">
                    <span className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full border-2 border-[var(--danger)] shrink-0" />
                    Copyright
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-[var(--danger)] mt-0.5 sm:mt-1">{uploadStats.copyright}</p>
                </div>
              </div>

              {/* Prominent Top-Level GitHub Sync Button */}
              <button
                type="button"
                onClick={() => setGithubModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent-deep)] px-5 py-3 text-xs sm:text-sm font-bold text-[var(--on-accent)] shadow-lg transition hover:brightness-110 active:scale-[0.98] shrink-0"
              >
                <GitHubIcon className="w-4 h-4" />
                <span>Sync ke GitHub</span>
                {uploadStats.active > 0 && (
                  <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] sm:text-[11px] font-extrabold text-[var(--on-accent)]">
                    {uploadStats.active}
                  </span>
                )}
              </button>
            </div>

            {/* Stepper Navigation */}
            <div className="max-w-2xl mx-auto py-2">
              <div className="relative flex items-center justify-between">
                {/* Precise Connector line anchored exactly at center of 34px step circles (top-[21px]) */}
                <div className="absolute left-[16.66%] right-[16.66%] top-[21px] h-[2px] -translate-y-1/2 rounded-full bg-[var(--surface-strong)] z-0 pointer-events-none" />
                <div
                  className="absolute top-[21px] h-[2px] -translate-y-1/2 rounded-full bg-gradient-to-r from-[var(--accent-soft)] to-[var(--accent)] transition-all duration-500 z-0 pointer-events-none"
                  style={{
                    left: '16.66%',
                    width: `${(activeStep - 1) * 33.33}%`,
                  }}
                />
                {[
                  { id: 1, label: 'Input Audio', icon: Music, badge: rawFiles.length },
                  { id: 2, label: 'Audio Tuning', icon: Wand2, badge: tunedFiles.length },
                  { id: 3, label: 'Output & Upload', icon: CloudUpload, badge: 0 },
                ].map((step) => {
                  const Icon = step.icon;
                  const isActive = activeStep === step.id;
                  const isDone = step.id < activeStep;
                  return (
                    <button
                      key={step.id}
                      onClick={() => goToStep(step.id)}
                      className="relative z-10 flex-1 flex flex-col items-center gap-2 py-1 select-none focus:outline-none"
                    >
                      <span
                        className={`relative z-10 flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 text-[11px] font-bold transition-all duration-300 ${
                          isActive
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-[#000000] shadow-[0_0_0_4px_var(--accent-12)]'
                            : isDone
                              ? 'border-[var(--accent-soft)] bg-[var(--bg)] text-[var(--accent-strong)]'
                              : 'border-[var(--line)] bg-[var(--bg)] text-[var(--text-40)]'
                        }`}
                      >
                        {isDone ? <Check className="w-3.5 h-3.5" /> : isActive ? <Icon className="w-4 h-4" /> : step.id}
                      </span>
                      <span
                        className={`flex items-center gap-1 text-[11px] font-semibold transition ${
                          isActive ? 'text-[var(--accent-strong)]' : isDone ? 'text-[var(--text-70)]' : 'text-[var(--text-40)]'
                        }`}
                      >
                        <span>{step.label}</span>
                        {step.badge > 0 && (
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none ${
                              isActive || isDone
                                ? 'bg-[var(--accent-15)] text-[var(--accent-strong)]'
                                : 'bg-[var(--surface-strong)] text-[var(--text-40)]'
                            }`}
                          >
                            {step.badge}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Animated Step Workstation Panels */}
            <AnimatePresence mode="wait">
              {activeStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <InputSection
                    onFilesAdded={addRawFiles}
                    rawFilesCount={rawFiles.length}
                    backendUrl={BACKEND_URL}
                    youtubeCookies={youtubeCookies}
                    onYoutubeCookiesChange={handleYoutubeCookiesChange}
                    onNext={() => goToStep(2)}
                  />
                </motion.div>
              )}

              {activeStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <TuningSection
                    rawFiles={rawFiles}
                    onTuningComplete={(results) => {
                      addTunedFiles(results);
                    }}
                    onRemoveRaw={removeRawFile}
                    onNext={() => goToStep(3)}
                    backendUrl={BACKEND_URL}
                  />
                </motion.div>
              )}

              {activeStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <OutputSection
                    tunedFiles={tunedFiles}
                    selectedAccount={selectedAccount}
                    onRemoveTuned={removeTunedFile}
                    onUploadSuccess={handleUploadSuccess}
                    backendUrl={BACKEND_URL}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inline Collapsible Upload History Drawer */}
            <div className="space-y-3">
              <div className="flex items-center justify-center">
                <button
                  onClick={() => setHistoryOpen(!historyOpen)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-2.5 text-xs font-semibold text-[var(--text-80)] transition hover:border-[var(--accent-30)] hover:text-[var(--accent-strong)] hover:bg-[var(--surface)]"
                >
                  <HistoryIcon className="w-4 h-4 text-[var(--accent-soft)]" />
                  <span>Riwayat Upload</span>
                  {uploadHistory.length > 0 && (
                    <span className="rounded-full bg-[var(--accent-15)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-strong)]">
                      {uploadHistory.length}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 text-[var(--text-45)] transition-transform duration-300 ${
                      historyOpen ? 'rotate-180 text-[var(--accent)]' : ''
                    }`}
                  />
                </button>
              </div>

              <AnimatePresence>
                {historyOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <UploadHistory
                      history={uploadHistory}
                      onClose={() => setHistoryOpen(false)}
                      onRefresh={handleRefreshStatus}
                      refreshingIds={refreshingIds}
                      onOpenGitHubSync={() => setGithubModalOpen(true)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Spoofer Tool (selalu ter-mount agar state tidak reset) */}
          <div className={activeTool === 'spoofer' ? 'space-y-6' : 'hidden'}>
            <SpooferSection
              selectedAccount={selectedAccount}
              backendUrl={BACKEND_URL}
            />
          </div>

          {/* Dumper Tool (selalu ter-mount agar state tidak reset) */}
          <div className={activeTool === 'dumper' ? 'space-y-6' : 'hidden'}>
            <DumperSection backendUrl={BACKEND_URL} />
          </div>

          {/* Obfuscator Tool (selalu ter-mount agar state tidak reset) */}
          <div className={activeTool === 'obfuscator' ? 'space-y-6' : 'hidden'}>
            <ObfuscatorSection />
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-[var(--line)] py-4 mt-8">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-40)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--emerald)]" />
              <span>S2 Studio</span>
            </div>
            {webVersion && (
              <p className="text-[11px] text-[var(--text-35)] font-mono">v{webVersion}</p>
            )}
          </div>
        </footer>

        {/* Account Modal Component */}
        <AccountModal
          isOpen={showAccountModal}
          onClose={() => setShowAccountModal(false)}
          onAccountAdded={handleAccountAdded}
          backendUrl={BACKEND_URL}
        />

        {/* Root-Level GitHub Sync Modal */}
        <GitHubExportModal
          isOpen={githubModalOpen}
          onClose={() => setGithubModalOpen(false)}
          backendUrl={BACKEND_URL}
          songs={uploadHistory
            .filter((r) => r.status === 'Active' && r.assetId)
            .map((r) => ({
              assetId: r.assetId,
              name: cleanSongTitle(r.displayName || r.fileName),
              playbackSpeed: r.robloxPlaybackSpeed || (1 / (r.originalSpeed || 1)).toFixed(4),
              originalSpeed: r.originalSpeed,
            }))}
        />
      </div>
    </ToastProvider>
  );
}
