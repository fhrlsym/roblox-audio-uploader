'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, CloudUpload, History as HistoryIcon, Lock, Music, Sparkles, Wand2 } from 'lucide-react';
import InputSection from '../components/InputSection';
import TuningSection from '../components/TuningSection';
import OutputSection from '../components/OutputSection';
import SpooferSection from '../components/SpooferSection';
import DumperSection from '../components/DumperSection';
import ObfuscatorSection from '../components/ObfuscatorSection';
import AccountModal from '../components/AccountModal';
import UploadHistory from '../components/UploadHistory';
import VersionChecker from '../components/VersionChecker';
import GitHubExportModal from '../components/GitHubExportModal';
import { ToastProvider } from '../components/Toast';
import { CARD, BTN_PRIMARY, cleanSongTitle } from '../lib/ui';
import { useSavedAccounts } from '../hooks/useSavedAccounts';
import { useUploadHistory } from '../hooks/useUploadHistory';
import { useAudioQueue } from '../hooks/useAudioQueue';
import AnimatedCounter from '../components/AnimatedCounter';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';

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
    isLoading: statsLoading,
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
      if (!target.closest('[data-popover-root]')) {
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
      <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
        <TopBar
          savedAccounts={savedAccounts}
          selectedAccount={selectedAccount}
          accountMenuOpen={accountMenuOpen}
          themeMenuOpen={themeOpen}
          theme={theme}
          themes={THEMES}
          onToggleAccountMenu={toggleAccountMenu}
          onToggleThemeMenu={toggleThemeMenu}
          onSelectAccount={selectAccount}
          onDeleteAccount={handleDeleteAccount}
          onAddAccount={() => {
            setAccountMenuOpen(false);
            setShowAccountModal(true);
          }}
          onSelectTheme={changeTheme}
        />
        
        {/* Main Layout: Sidebar + Content */}
        <div className="flex flex-1">
          {/* Sidebar Navigation */}
          <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />
           
          {/* Main Application Workbench */}
          <main className="min-w-0 flex-1 overflow-y-auto pb-20 lg:pb-0">
            <div className="max-w-[1400px] w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {/* Audio Master Tool (selalu ter-mount agar state tidak reset) */}
          <div className={activeTool === 'audio-master' ? 'space-y-4' : 'hidden'}>
            <section className="hero-panel relative overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--panel)] px-5 py-6 sm:px-7 sm:py-7">
              <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--accent-10)] blur-3xl" />
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-20)] bg-[var(--accent-10)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                    <Sparkles className="h-3 w-3" />
                    Audio production workspace
                  </span>
                  <h2 className="mt-4 font-serif text-3xl font-semibold leading-none tracking-tight text-[var(--text)] sm:text-4xl">
                    Dari lagu mentah jadi asset Roblox.
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-50)]">
                    Ambil audio, atur karakter suaranya, lalu upload ke akun Roblox pilihanmu dalam satu alur yang rapi.
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--on-accent)] shadow-sm">
                    <Music className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-40)]">Sekarang</p>
                    <p className="text-sm font-bold text-[var(--text)]">Langkah {activeStep} dari 3</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className={`${CARD} p-2.5 sm:p-3 text-center relative overflow-hidden`}>
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[var(--accent-40)] via-[var(--accent)] to-[var(--accent-40)] shimmer-bar" />
                  <p className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider inline-flex items-center gap-1 text-[var(--text-45)]">
                    <CloudUpload className="w-3 h-3 text-[var(--accent-soft)]" />
                    Total
                  </p>
                  <p className="text-base sm:text-lg font-bold text-[var(--text)] mt-0.5">{statsLoading ? <span className="skeleton inline-block w-8 h-6 rounded-md" /> : <AnimatedCounter value={uploadStats.total} />}</p>
                </div>
                <div className={`${CARD} p-2.5 sm:p-3 text-center relative overflow-hidden`}>
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 shimmer-bar" />
                  <p className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider inline-flex items-center gap-1 text-[var(--text-45)]">
                    <Check className="w-3 h-3 text-[var(--emerald)]" />
                    Success
                  </p>
                  <p className="text-base sm:text-lg font-bold text-[var(--emerald)] mt-0.5">{statsLoading ? <span className="skeleton inline-block w-8 h-6 rounded-md" /> : <AnimatedCounter value={uploadStats.active} />}</p>
                </div>
                <div className={`${CARD} p-2.5 sm:p-3 text-center relative overflow-hidden`}>
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-rose-400 via-rose-500 to-rose-400 shimmer-bar" />
                  <p className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider inline-flex items-center gap-1 text-[var(--text-45)]">
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-[var(--danger)] shrink-0" />
                    Copyright
                  </p>
                  <p className="text-base sm:text-lg font-bold text-[var(--danger)] mt-0.5">{statsLoading ? <span className="skeleton inline-block w-8 h-6 rounded-md" /> : <AnimatedCounter value={uploadStats.copyright} />}</p>
                </div>
              </div>


            {/* Stepper Navigation */}
            <div className="max-w-2xl mx-auto py-1">
              <div className="relative flex items-center justify-between">
                {/* Background connector track */}
                <div className="absolute left-[16.66%] right-[16.66%] top-[21px] h-[2px] -translate-y-1/2 rounded-full bg-[var(--surface-strong)] z-0 pointer-events-none" />
                {/* Animated progress connector */}
                <motion.div
                  className="absolute top-[21px] h-[2px] -translate-y-1/2 rounded-full z-0 pointer-events-none overflow-hidden"
                  style={{ left: '16.66%' }}
                  animate={{ width: `${(activeStep - 1) * 33.33}%` }}
                  transition={{ type: 'spring', stiffness: 200, damping: 28 }}
                >
                  <div className="w-full h-full bg-gradient-to-r from-[var(--accent-soft)] via-[var(--accent)] to-[var(--accent-soft)] shimmer-bar" />
                </motion.div>
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
                      <span className="relative">
                        {/* Active glow ring pulse */}
                        {isActive && (
                          <motion.span
                            className="absolute inset-0 rounded-full border-2 border-[var(--accent)]"
                            initial={{ scale: 1, opacity: 0.6 }}
                            animate={{ scale: 1.4, opacity: 0 }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                          />
                        )}
                        <span
                          className={`relative z-10 flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 text-[11px] font-bold transition-all duration-300 ${
                            isActive
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-[#000000] shadow-[0_0_0_4px_var(--accent-12)]'
                              : isDone
                                ? 'border-[var(--accent-soft)] bg-[var(--bg)] text-[var(--accent-strong)]'
                                : 'border-[var(--line)] bg-[var(--bg)] text-[var(--text-40)]'
                          }`}
                        >
                          {isDone ? (
                            <motion.span
                              initial={{ scale: 0, rotate: -90 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </motion.span>
                          ) : isActive ? (
                            <Icon className="w-4 h-4" />
                          ) : (
                            step.id
                          )}
                        </span>
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
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="mb-16 mt-auto shrink-0 border-t border-[var(--line)] py-4 lg:mb-0">
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
