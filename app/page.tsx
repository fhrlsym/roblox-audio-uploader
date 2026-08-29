'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, CloudUpload, History as HistoryIcon, LockKeyhole, Music, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import LandingSection from '../components/LandingSection';
import S2Logo from '../components/S2Logo';
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
import { cleanSongTitle } from '../lib/ui';
import { useSavedAccounts } from '../hooks/useSavedAccounts';
import { useUploadHistory } from '../hooks/useUploadHistory';
import { useAudioQueue } from '../hooks/useAudioQueue';
import AnimatedCounter from '../components/AnimatedCounter';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import { StatCard } from '../components/ui/StatCard';
import { Stepper } from '../components/ui/Stepper';
import { useTheme, type ThemeName, type ThemeMode } from '../hooks/useTheme';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const CORRECT_PIN = process.env.NEXT_PUBLIC_PIN || '515753';

const THEMES: { id: ThemeName; label: string; swatch: string }[] = [
  { id: 'default', label: 'Default', swatch: '#4f46e5' },
  { id: 'gold', label: 'Gold', swatch: '#a67c00' },
  { id: 'emerald', label: 'Emerald', swatch: '#0f9d6b' },
  { id: 'royal', label: 'Royal', swatch: '#6d5ae0' },
  { id: 'ocean', label: 'Ocean', swatch: '#0e94d4' },
  { id: 'graphite', label: 'Graphite', swatch: '#59677d' },
  { id: 'sunset', label: 'Sunset', swatch: '#ea580c' },
  { id: 'rose', label: 'Rose', swatch: '#e11d48' },
  { id: 'mint', label: 'Mint', swatch: '#10b981' },
];

const MODES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Light' },
];

export default function Home() {
  const [activeTool, setActiveTool] = useState<'audio-master' | 'spoofer' | 'dumper' | 'obfuscator'>('audio-master');
  const [unlocked, setUnlocked] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const { theme, mode, setTheme, setMode } = useTheme();
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
    const settings = JSON.parse(localStorage.getItem('audioUploader_settings') || '{}');
    if (settings.youtubeCookies) setYoutubeCookies(settings.youtubeCookies);
  }, []);

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
      setPinOpen(false);
      setUnlocked(true);
    } else {
      setPinError(true);
      setPin('');
    }
  };

  const handleClosePin = () => {
    setPinOpen(false);
    setPin('');
    setPinError(false);
  };

  const changeTheme = (newTheme: ThemeName) => {
    setTheme(newTheme);
    setThemeOpen(false);
  };

  const changeMode = (newMode: ThemeMode) => {
    setMode(newMode);
    setThemeOpen(false);
  };

  const handleYoutubeCookiesChange = (cookies: string) => {
    setYoutubeCookies(cookies);
    try {
      const settings = JSON.parse(localStorage.getItem('audioUploader_settings') || '{}');
      settings.youtubeCookies = cookies;
      localStorage.setItem('audioUploader_settings', JSON.stringify(settings));
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
        <LandingSection onEnter={() => setPinOpen(true)} />
        <Modal
          isOpen={pinOpen}
          onClose={handleClosePin}
          size="sm"
          preventClose={false}
        >
          <div className="flex flex-col items-center text-center">
            <div className="brutal-icon-box mb-4 flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[var(--text)] bg-[var(--accent)] text-white shadow-[4px_4px_0_0_var(--text)]">
              <S2Logo className="h-7 w-7" />
            </div>
            <h2 id="access-title" className="text-xl font-extrabold uppercase tracking-wide text-[var(--text)]">Masuk ke Studio</h2>
            <p className="mt-1 text-xs font-medium text-[var(--text-50)]">Masukkan access code untuk membuka workspace.</p>
          </div>

          <form onSubmit={handlePinSubmit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <label htmlFor="access-code" className="block text-center text-[10px] font-bold uppercase tracking-wide text-[var(--text-50)]">
                Access Code
              </label>
              <div className="relative">
                <LockKeyhole size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-50)]" />
                <input
                  id="access-code"
                  data-autofocus
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
                  aria-invalid={pinError}
                  aria-describedby={pinError ? 'access-error' : undefined}
                  className={`w-full rounded-lg border-2 border-[var(--text)] bg-[var(--bg)] py-4 pl-11 pr-4 text-center text-lg font-mono tracking-[0.3em] outline-none transition-colors duration-150 focus:border-[var(--accent)] placeholder:tracking-normal placeholder:text-sm placeholder:font-normal ${
                    pinError ? 'border-[var(--danger)] bg-[var(--danger)]/5' : ''
                  }`}
                />
              </div>
              <AnimatePresence mode="wait">
                {pinError && (
                  <motion.p
                    id="access-error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="rounded-md border-2 border-[var(--danger)] bg-[var(--danger)] px-3 py-1.5 text-center text-xs font-bold uppercase text-white"
                  >
                    Code tidak valid. Periksa lalu coba lagi.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <button
              type="submit"
              disabled={pin.length !== 6}
              className="brutal-btn-primary w-full justify-center py-3.5"
            >
              <LockKeyhole className="mr-2 inline-block h-4 w-4" />
              Enter Workspace
            </button>
          </form>
        </Modal>
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
          mode={mode}
          themes={THEMES}
          modes={MODES}
          onToggleAccountMenu={toggleAccountMenu}
          onToggleThemeMenu={toggleThemeMenu}
          onSelectAccount={selectAccount}
          onDeleteAccount={handleDeleteAccount}
          onAddAccount={() => {
            setAccountMenuOpen(false);
            setShowAccountModal(true);
          }}
          onSelectTheme={changeTheme}
          onSelectMode={changeMode}
        />
        
        {/* Main Layout: Sidebar + Content */}
        <div className="flex flex-1">
          {/* Sidebar Navigation */}
          <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />
           
          {/* Main Application Workbench */}
          <main className="min-w-0 flex-1 overflow-y-auto pb-20 lg:pb-0">
            <div className="max-w-[1400px] w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <AnimatePresence mode="wait">
            {activeTool === 'audio-master' && (
              <motion.div
                key="audio-master"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="space-y-4"
              >
            <section className="brutal-card relative overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <span className="brutal-icon-box h-12 w-12 bg-[var(--accent)] text-white">
                    <Music className="h-6 w-6" />
                  </span>
                  <div>
                    <h2 className="text-lg font-extrabold uppercase tracking-wide text-[var(--text)]">Audio Master</h2>
                    <p className="mt-0.5 text-sm font-medium text-[var(--text-50)]">Upload &rarr; Tune &rarr; Roblox</p>
                  </div>
                </div>
                <div className="brutal-tag flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Step {activeStep} / 3</span>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <StatCard
                label="Total"
                icon={<CloudUpload className="h-3 w-3" />}
                value={statsLoading ? <span className="skeleton inline-block h-6 w-8 rounded-md" /> : <AnimatedCounter value={uploadStats.total} />}
              />
              <StatCard
                label="Active"
                icon={<CheckCircle2 className="h-3 w-3" />}
                tone="success"
                value={statsLoading ? <span className="skeleton inline-block h-6 w-8 rounded-md" /> : <AnimatedCounter value={uploadStats.active} />}
              />
              <StatCard
                label="Copyright"
                icon={<ShieldAlert className="h-3 w-3" />}
                tone="danger"
                value={statsLoading ? <span className="skeleton inline-block h-6 w-8 rounded-md" /> : <AnimatedCounter value={uploadStats.copyright} />}
              />
            </div>

            {/* Stepper Navigation */}
            <div className="mx-auto max-w-2xl py-1">
              <Stepper
                steps={[
                  { id: 1, label: 'Input', icon: Music, badge: rawFiles.length },
                  { id: 2, label: 'Tuning', icon: SlidersHorizontal, badge: tunedFiles.length },
                  { id: 3, label: 'Upload', icon: CloudUpload, badge: 0 },
                ]}
                activeStep={activeStep}
                onStepClick={goToStep}
              />
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
                  className="brutal-btn-flat inline-flex items-center gap-2"
                >
                  <HistoryIcon className="h-4 w-4" />
                  <span>Riwayat Upload</span>
                  {uploadHistory.length > 0 && (
                    <span className="rounded-full border-2 border-[var(--text)] bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[var(--on-accent)]">
                      {uploadHistory.length}
                    </span>
                  )}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-300 ${
                      historyOpen ? 'rotate-180' : ''
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
              </motion.div>
            )}

            {activeTool === 'spoofer' && (
              <motion.div
                key="spoofer"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="space-y-6"
              >
                <SpooferSection
                  selectedAccount={selectedAccount}
                  backendUrl={BACKEND_URL}
                />
              </motion.div>
            )}

            {activeTool === 'dumper' && (
              <motion.div
                key="dumper"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="space-y-6"
              >
                <DumperSection backendUrl={BACKEND_URL} />
              </motion.div>
            )}

            {activeTool === 'obfuscator' && (
              <motion.div
                key="obfuscator"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="space-y-6"
              >
                <ObfuscatorSection />
              </motion.div>
            )}
          </AnimatePresence>
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="mt-auto shrink-0 border-t-2 border-[var(--text)] py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-50)]">
              <span className="h-2 w-2 border-2 border-[var(--text)] bg-[var(--emerald)]" />
              <span>S2 Studio</span>
            </div>
            {webVersion && (
              <p className="text-[11px] font-bold font-mono text-[var(--text-40)]">v{webVersion}</p>
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
