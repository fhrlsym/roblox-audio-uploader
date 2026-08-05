'use client';

import { useState, useEffect, Fragment } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Check, ChevronDown, ChevronLeft, CloudUpload, Music, Plus, Trash2, User, Wand2 } from 'lucide-react';
import InputSection from '../components/InputSection';
import TuningSection from '../components/TuningSection';
import OutputSection from '../components/OutputSection';
import SpooferSection from '../components/SpooferSection';
import AccountModal from '../components/AccountModal';
import UploadHistory from '../components/UploadHistory';
import VersionChecker from '../components/VersionChecker';
import { ToastProvider } from '../components/Toast';
import { CARD, PANEL, LABEL, BTN_PRIMARY } from '../lib/ui';
import { useSavedAccounts } from '../hooks/useSavedAccounts';
import { useUploadHistory } from '../hooks/useUploadHistory';
import { useAudioQueue } from '../hooks/useAudioQueue';
import { Sparkles } from 'lucide-react';

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

export default function Home() {
  const [activeTool, setActiveTool] = useState<'audio-master' | 'spoofer'>('audio-master');
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [theme, setTheme] = useState('gold-dark');
  const [themeOpen, setThemeOpen] = useState(false);
  const [youtubeCookies, setYoutubeCookies] = useState('');

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
    refreshingIds,
    handleRefreshStatus,
    refreshPendingStatuses,
    handleUploadSuccess,
    handleClearHistory,
  } = useUploadHistory(unlocked, BACKEND_URL, selectedAccountRef);

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
    const savedPin = localStorage.getItem('audioUploader_pin');
    if (savedPin === CORRECT_PIN) setUnlocked(true);

    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (settings.theme) setTheme(settings.theme);
      if (settings.youtubeCookies) setYoutubeCookies(settings.youtubeCookies);
    } catch {
      // ignore
    }
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
  }, [unlocked]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      localStorage.setItem('audioUploader_pin', pin);
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

  if (!unlocked) {
    return (
      <ToastProvider>
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`${PANEL} w-full max-w-sm p-6 space-y-4 text-center`}
          >
            <div className="w-12 h-12 rounded-2xl bg-[var(--accent-15)] flex items-center justify-center mx-auto text-[var(--accent)]">
              <Music className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text)] tracking-tight">Audio Master to Roblox</h1>
              <p className="text-xs text-[var(--text-45)] mt-1">Masukkan PIN untuk melanjutkan</p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-3">
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setPinError(false);
                }}
                placeholder="******"
                className="w-full text-center text-2xl tracking-[0.5em] py-2 bg-[var(--surface-50)] border border-[var(--line)] rounded-xl text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition"
              />
              {pinError && <p className="text-xs text-[var(--danger)]">PIN salah, coba lagi.</p>}
              <button type="submit" className={`${BTN_PRIMARY} w-full py-2.5 text-sm font-medium`}>
                Buka Akses
              </button>
            </form>
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
        <header className="sticky top-0 z-40 bg-[var(--surface)] border-b border-[var(--line)] backdrop-blur-lg bg-opacity-80">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent-15)] flex items-center justify-center text-[var(--accent)]">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-sm leading-none text-[var(--text)]">S2 Studio</h1>
                <p className="text-[11px] text-[var(--text-45)] font-medium mt-0.5">
                  {activeTool === 'audio-master' ? 'Audio Master to Roblox' : 'Animation & Sound Spoofer'}
                </p>
              </div>

              {/* Tool Switcher */}
              <div className="hidden sm:flex items-center gap-1.5 p-1 bg-[var(--surface-50)] rounded-xl border border-[var(--line)] ml-4">
                <button
                  onClick={() => setActiveTool('audio-master')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    activeTool === 'audio-master' ? 'bg-[var(--accent)] text-[#000000]' : 'text-[var(--text-60)] hover:text-[var(--text)]'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                  Audio Master
                </button>
                <button
                  onClick={() => setActiveTool('spoofer')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    activeTool === 'spoofer' ? 'bg-[var(--accent)] text-[#000000]' : 'text-[var(--text-60)] hover:text-[var(--text)]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Animation & Sound Spoofer
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Account Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] hover:bg-[var(--surface)] text-xs transition"
                >
                  {selectedAccount ? (
                    <>
                      {selectedAccount.type === 'group' ? (
                        <Building2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-[var(--accent)]" />
                      )}
                      <span className="font-medium max-w-[120px] truncate">{selectedAccount.name}</span>
                    </>
                  ) : (
                    <span className="text-[var(--text-45)]">Pilih Akun</span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-45)]" />
                </button>

                {accountMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[var(--line)] bg-[var(--surface-pop)] p-2 shadow-2xl z-50 space-y-1">
                    <div className="px-2 py-1.5 text-[10px] font-semibold tracking-wider text-[var(--text-40)] uppercase">
                      Akun Tersimpan
                    </div>
                    {savedAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition cursor-pointer ${
                          selectedAccount?.id === acc.id
                            ? 'bg-[var(--accent-15)] text-[var(--accent-strong)] font-semibold'
                            : 'text-[var(--text-70)] hover:bg-[var(--surface)]'
                        }`}
                        onClick={() => selectAccount(acc)}
                      >
                        <span className="truncate">{acc.name}</span>
                        <div className="flex items-center gap-1">
                          {selectedAccount?.id === acc.id && <Check className="w-3.5 h-3.5 shrink-0" />}
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
                    ))}

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
                  </div>
                )}
              </div>

              {/* Theme Picker */}
              <div className="relative">
                <button
                  onClick={() => setThemeOpen(!themeOpen)}
                  className="w-8 h-8 rounded-xl border border-[var(--line)] flex items-center justify-center hover:bg-[var(--surface-50)] transition"
                >
                  <div
                    className="w-4 h-4 rounded-full border border-[var(--line)]"
                    style={{ background: THEMES.find((t) => t.id === theme)?.swatch }}
                  />
                </button>

                {themeOpen && (
                  <div className="absolute right-0 mt-2 w-40 rounded-2xl border border-[var(--line)] bg-[var(--surface-pop)] p-2 shadow-2xl z-50 grid grid-cols-2 gap-1">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => changeTheme(t.id)}
                        className={`flex items-center gap-2 p-1.5 rounded-xl text-[11px] font-medium transition ${
                          theme === t.id ? 'bg-[var(--accent-15)] text-[var(--accent-strong)]' : 'hover:bg-[var(--surface)] text-[var(--text-70)]'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.swatch }} />
                        <span className="truncate">{t.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Application Workbench */}
        <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {activeTool === 'spoofer' ? (
            <motion.div
              key="spoofer-tool"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <SpooferSection
                selectedAccount={selectedAccount}
                backendUrl={BACKEND_URL}
                onConvertToAudioMaster={(songTitle) => {
                  setActiveTool('audio-master');
                  goToStep(1);
                }}
              />
            </motion.div>
          ) : (
            <>
              {/* Top Overview & Stats Bar */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className={`${CARD} p-4 text-center`}>
                  <p className="text-[11px] font-medium text-[var(--text-45)] uppercase tracking-wider">Total Upload</p>
                  <p className="text-2xl font-bold text-[var(--text)] mt-1">{uploadStats.total}</p>
                </div>
                <div className={`${CARD} p-4 text-center`}>
                  <p className="text-[11px] font-medium text-[var(--text-45)] uppercase tracking-wider">Active</p>
                  <p className="text-2xl font-bold text-[var(--emerald)] mt-1">{uploadStats.active}</p>
                </div>
                <div className={`${CARD} p-4 text-center`}>
                  <p className="text-[11px] font-medium text-[var(--text-45)] uppercase tracking-wider">Pending</p>
                  <p className="text-2xl font-bold text-[var(--accent)] mt-1">{uploadStats.pending}</p>
                </div>
                <div className={`${CARD} p-4 text-center`}>
                  <p className="text-[11px] font-medium text-[var(--text-45)] uppercase tracking-wider">Copyright</p>
                  <p className="text-2xl font-bold text-[var(--danger)] mt-1">{uploadStats.copyright}</p>
                </div>
                <div className={`${CARD} p-4 text-center col-span-2 md:col-span-1`}>
                  <p className="text-[11px] font-medium text-[var(--text-45)] uppercase tracking-wider">Sisa Kuota Roblox</p>
                  <p className="text-2xl font-bold text-[var(--accent-strong)] mt-1">
                    {selectedAccount?.quota ? `${selectedAccount.quota.capacity - selectedAccount.quota.usage}` : '-'}
                  </p>
                </div>
              </div>

              {/* Stepper Navigation */}
              <div className="flex items-center justify-between max-w-2xl mx-auto bg-[var(--surface-50)] p-1.5 rounded-2xl border border-[var(--line)]">
                {[
                  { id: 1, label: '1. Input Audio', icon: Music, badge: rawFiles.length },
                  { id: 2, label: '2. Audio Tuning', icon: Wand2, badge: tunedFiles.length },
                  { id: 3, label: '3. Output & Upload', icon: CloudUpload, badge: 0 },
                ].map((step) => {
                  const Icon = step.icon;
                  const isActive = activeStep === step.id;
                  return (
                    <button
                      key={step.id}
                      onClick={() => goToStep(step.id)}
                      className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-[var(--accent)] text-[#000000] shadow-md'
                          : 'text-[var(--text-60)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{step.label}</span>
                      {step.badge > 0 && (
                        <span
                          className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                            isActive ? 'bg-[#000000] text-[var(--accent)]' : 'bg-[var(--accent-15)] text-[var(--accent-strong)]'
                          }`}
                        >
                          {step.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
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

              {/* Global Upload History Table */}
              <UploadHistory
                history={uploadHistory}
                onClear={handleClearHistory}
                onRefresh={handleRefreshStatus}
                refreshingIds={refreshingIds}
              />
            </>
          )}
        </main>

        {/* Account Modal Component */}
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
