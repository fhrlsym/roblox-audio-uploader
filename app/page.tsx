'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCircle2, ChevronDown, CloudUpload, History as HistoryIcon, LockKeyhole, Music, ShieldAlert, SlidersHorizontal } from 'lucide-react';
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
  { id: 'system', label: 'System', swatch: 'linear-gradient(135deg, #34d399, #a67c00)' },
  { id: 'gold-dark', label: 'Gold Dark', swatch: 'linear-gradient(135deg, #f0cd6b, #b8912a)' },
  { id: 'light', label: 'Light', swatch: 'linear-gradient(135deg, #ffffff, #e2e8f0)' },
  { id: 'emerald', label: 'Emerald', swatch: 'linear-gradient(135deg, #55e0ab, #1f8f68)' },
  { id: 'royal', label: 'Royal', swatch: 'linear-gradient(135deg, #b0a4ff, #6a58d6)' },
  { id: 'ocean', label: 'Ocean', swatch: 'linear-gradient(135deg, #7dd3fc, #1f8fc9)' },
  { id: 'graphite', label: 'Graphite', swatch: 'linear-gradient(135deg, #cbd5e1, #465368)' },
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
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] p-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-12%,var(--accent-12),transparent_50%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, var(--accent) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-sm"
            aria-labelledby="access-title"
          >
            <div className="gradient-border rounded-2xl">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl backdrop-blur-sm overflow-hidden">
                <div className="px-6 pt-7 sm:px-8">
                  <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center mb-4 shadow-lg shadow-[var(--accent-20)]">
                      <Music className="h-7 w-7 text-[var(--on-accent)]" />
                    </div>
                    <h1 id="access-title" className="text-2xl font-bold text-[var(--text)] tracking-tight">S2 Studio</h1>
                    <p className="text-sm text-[var(--text-50)] mt-1">Audio Master to Roblox</p>
                  </div>
                </div>

                <form onSubmit={handlePinSubmit} className="space-y-5 px-6 pb-7 sm:px-8">
                  <div className="space-y-2">
                    <label htmlFor="access-code" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-45)] block text-center">
                      Access Code
                    </label>
                    <motion.div
                      animate={pinError ? { x: [-6, 6, -4, 4, -2, 2, 0] } : {}}
                      transition={{ duration: 0.35 }}
                    >
                      <div className="relative">
                        <LockKeyhole size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-35)]" />
                        <input
                          id="access-code"
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
                          placeholder="Enter 6-digit code"
                          autoFocus
                          aria-invalid={pinError}
                          aria-describedby={pinError ? 'access-error' : undefined}
                          className={`w-full bg-[var(--surface-focus)] text-[var(--text)] rounded-xl py-4 pl-11 pr-4 border text-sm text-center tracking-[0.3em] text-lg font-mono outline-none transition duration-150 ease-out focus:border-[var(--accent-40)] focus:ring-2 focus:ring-[var(--accent-20)] placeholder:tracking-normal placeholder:text-sm placeholder:font-normal ${
                            pinError ? 'border-[var(--danger)]' : 'border-[var(--line)]'
                          }`}
                        />
                      </div>
                    </motion.div>
                    <AnimatePresence mode="wait">
                      {pinError && (
                        <motion.p
                          id="access-error"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="text-xs text-[var(--danger)] text-center"
                        >
                          Code tidak valid. Periksa lalu coba lagi.
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    type="submit"
                    disabled={pin.length !== 6}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent-deep)] text-[var(--on-accent)] font-semibold text-sm transition duration-150 ease-out hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 shadow-lg shadow-[var(--accent-15)]"
                  >
                    <LockKeyhole className="h-4 w-4 inline-block mr-2" />
                    Enter Workspace
                  </button>
                </form>
              </div>
            </div>
            <p className="mt-6 text-center text-[10px] text-[var(--text-30)]">Built by fhrlsym</p>
          </motion.section>
        </main>
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
            <section className="relative overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--panel)] px-5 py-6 sm:px-7 sm:py-7">
              <div className="absolute inset-0 hero-gradient opacity-80" />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-[var(--on-accent)] shadow-lg shadow-[var(--accent-20)]">
                    <Music className="h-6 w-6" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">Audio Master</h2>
                    <p className="mt-0.5 text-sm text-[var(--text-50)]">Upload &rarr; Tune &rarr; Roblox</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[var(--accent-25)] bg-[var(--accent-08)] px-3 py-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                  <span className="text-[11px] font-semibold text-[var(--accent-strong)]">Step {activeStep} / 3</span>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className={`${CARD} p-3 text-center`}>
                <p className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-45)]">
                  <CloudUpload className="h-3 w-3 text-[var(--accent-soft)]" />
                  Total
                </p>
                <p className="mt-1 text-lg font-bold text-[var(--text)]">{statsLoading ? <span className="skeleton inline-block h-6 w-8 rounded-md" /> : <AnimatedCounter value={uploadStats.total} />}</p>
              </div>
              <div className={`${CARD} p-3 text-center`}>
                <p className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-45)]">
                  <CheckCircle2 className="h-3 w-3 text-[var(--emerald)]" />
                  Active
                </p>
                <p className="mt-1 text-lg font-bold text-[var(--emerald)]">{statsLoading ? <span className="skeleton inline-block h-6 w-8 rounded-md" /> : <AnimatedCounter value={uploadStats.active} />}</p>
              </div>
              <div className={`${CARD} p-3 text-center`}>
                <p className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-45)]">
                  <ShieldAlert className="h-3 w-3 text-[var(--danger)]" />
                  Copyright
                </p>
                <p className="mt-1 text-lg font-bold text-[var(--danger)]">{statsLoading ? <span className="skeleton inline-block h-6 w-8 rounded-md" /> : <AnimatedCounter value={uploadStats.copyright} />}</p>
              </div>
            </div>


            {/* Stepper Navigation */}
            <div className="mx-auto max-w-2xl py-1">
              <div className="relative flex items-center justify-between">
                <div className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-[19px] z-0 h-[2px] -translate-y-1/2 rounded-full bg-[var(--surface-strong)]" />
                <motion.div
                  className="pointer-events-none absolute top-[19px] z-0 h-[2px] -translate-y-1/2 rounded-full bg-[var(--accent)]"
                  style={{ left: '16.66%' }}
                  animate={{ width: `${(activeStep - 1) * 33.33}%` }}
                  transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                />
                {[
                  { id: 1, label: 'Input', icon: Music, badge: rawFiles.length },
                  { id: 2, label: 'Tuning', icon: SlidersHorizontal, badge: tunedFiles.length },
                  { id: 3, label: 'Upload', icon: CloudUpload, badge: 0 },
                ].map((step) => {
                  const Icon = step.icon;
                  const isActive = activeStep === step.id;
                  const isDone = step.id < activeStep;
                  return (
                    <button
                      key={step.id}
                      onClick={() => goToStep(step.id)}
                      aria-current={isActive ? 'step' : undefined}
                      className="relative z-10 flex flex-1 select-none flex-col items-center gap-2 rounded-lg py-1"
                    >
                      <span
                        className={`flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors duration-200 ${
                          isActive
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]'
                            : isDone
                              ? 'border-[var(--accent)] bg-[var(--accent-15)] text-[var(--accent-strong)]'
                              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--text-40)]'
                        }`}
                      >
                        {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </span>
                      <span className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${isActive ? 'text-[var(--text)]' : isDone ? 'text-[var(--text-70)]' : 'text-[var(--text-40)]'}`}>
                        <span>{step.label}</span>
                        {step.badge > 0 && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${isActive || isDone ? 'bg-[var(--accent-15)] text-[var(--accent-strong)]' : 'bg-[var(--surface-strong)] text-[var(--text-40)]'}`}>
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
        <footer className="mt-auto shrink-0 border-t border-[var(--line)] py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-40)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--emerald)]" />
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
