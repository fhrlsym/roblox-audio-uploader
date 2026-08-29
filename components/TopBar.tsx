'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Check, ChevronDown, Palette, Plus, Trash2, User } from 'lucide-react';
import S2Logo from './S2Logo';
import type { SavedAccount } from '../types/audio';
import type { ThemeName, ThemeMode } from '../hooks/useTheme';

interface ThemeOption {
  id: ThemeName;
  label: string;
  swatch: string;
}

interface ModeOption {
  id: ThemeMode;
  label: string;
}

interface TopBarProps {
  savedAccounts: SavedAccount[];
  selectedAccount: SavedAccount | null;
  accountMenuOpen: boolean;
  themeMenuOpen: boolean;
  theme: ThemeName;
  mode: ThemeMode;
  themes: ThemeOption[];
  modes: ModeOption[];
  onToggleAccountMenu: () => void;
  onToggleThemeMenu: () => void;
  onSelectAccount: (account: SavedAccount) => void;
  onDeleteAccount: (id: string) => void;
  onAddAccount: () => void;
  onSelectTheme: (theme: ThemeName) => void;
  onSelectMode: (mode: ThemeMode) => void;
}

export default function TopBar({
  savedAccounts,
  selectedAccount,
  accountMenuOpen,
  themeMenuOpen,
  theme,
  mode,
  themes,
  modes,
  onToggleAccountMenu,
  onToggleThemeMenu,
  onSelectAccount,
  onDeleteAccount,
  onAddAccount,
  onSelectTheme,
  onSelectMode,
}: TopBarProps) {
  return (
    <header className="relative z-50 h-16 shrink-0 border-b-2 border-[var(--text)] bg-[var(--panel)]">
      <div className="flex h-full items-center justify-between px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="brutal-box flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
            <S2Logo className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold uppercase leading-none tracking-tight text-[var(--text)]">S2 Studio</h1>
            <p className="mt-1 hidden text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--text-50)] sm:block">Roblox Creator Suite</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="relative" data-popover-root>
            <button
              type="button"
              onClick={onToggleThemeMenu}
              aria-label="Pilih tema"
              aria-expanded={themeMenuOpen}
              className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[var(--text)] bg-[var(--bg)] text-[var(--text)] transition active:translate-y-[1px] hover:bg-[var(--accent)] hover:text-[var(--on-accent)]"
            >
              <Palette className="h-4 w-4" />
            </button>

            <AnimatePresence>
              {themeMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, transform: 'translateY(-4px) scale(0.98)' }}
                  animate={{ opacity: 1, transform: 'translateY(0) scale(1)' }}
                  exit={{ opacity: 0, transform: 'translateY(-2px) scale(0.98)' }}
                  transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                  role="menu"
                  aria-label="Pilihan tema"
                  className="absolute right-0 top-full mt-2 max-h-[70vh] w-52 origin-top-right overflow-y-auto rounded-lg border-2 border-[var(--text)] bg-[var(--panel)] p-1.5 shadow-[4px_4px_0_0_var(--text)]"
                >
                  <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-50)]">Tema Warna</p>
                  {themes.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={theme === option.id}
                      onClick={() => onSelectTheme(option.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs font-bold uppercase tracking-wide transition ${
                        theme === option.id
                          ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                          : 'text-[var(--text-70)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                      }`}
                    >
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[var(--text)]" style={{ background: option.swatch }} />
                      <span className="flex-1">{option.label}</span>
                      {theme === option.id && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative" data-popover-root>
            <button
              type="button"
              onClick={onToggleAccountMenu}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              aria-label={selectedAccount ? `Akun target: ${selectedAccount.name}` : 'Pilih akun target'}
              className="flex h-8 max-w-[170px] items-center gap-2 rounded-lg border-2 border-[var(--text)] bg-[var(--bg)] px-2 text-left transition active:translate-y-[1px] hover:-translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--text)] sm:max-w-[230px]"
            >
              {selectedAccount?.thumbnail ? (
                <img src={selectedAccount.thumbnail} alt="" className="h-5 w-5 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-[var(--on-accent)]">
                  {selectedAccount?.type === 'group' ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[var(--text-90)] sm:text-xs">
                {selectedAccount?.name || 'Pilih akun'}
              </span>
              <ChevronDown className={`h-3 w-3 shrink-0 text-[var(--text)] transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {accountMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, transform: 'translateY(-4px) scale(0.98)' }}
                  animate={{ opacity: 1, transform: 'translateY(0) scale(1)' }}
                  exit={{ opacity: 0, transform: 'translateY(-2px) scale(0.98)' }}
                  transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                  className="fixed left-3 right-3 top-[64px] max-h-[75vh] overflow-y-auto rounded-lg border-2 border-[var(--text)] bg-[var(--panel)] p-2 shadow-[6px_6px_0_0_var(--text)] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
                >
                  <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-50)]">Akun target</p>
                  <div className="space-y-1">
                    {savedAccounts.map((account) => {
                      const selected = selectedAccount?.id === account.id;
                      const usage = account.quota?.usage ?? 0;
                      const capacity = account.quota?.capacity ?? 0;
                      const percentage = capacity > 0 ? Math.min(100, (usage / capacity) * 100) : 0;

                      return (
                        <div
                          key={account.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectAccount(account)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onSelectAccount(account);
                            }
                          }}
                          className={`group w-full cursor-pointer rounded-md border-2 p-2.5 text-left transition ${
                            selected
                              ? 'border-[var(--text)] bg-[var(--accent)] text-[var(--on-accent)]'
                              : 'border-transparent hover:border-[var(--line)] hover:bg-[var(--surface)]'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            {account.thumbnail ? (
                              <img src={account.thumbnail} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                            ) : (
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-[var(--text)] ${selected ? 'bg-white/20' : 'bg-[var(--surface)] text-[var(--text-50)]'}`}>
                                {account.type === 'group' ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-xs font-bold uppercase tracking-wide">{account.name}</span>
                                {selected && <span className="border-2 border-[var(--text)] bg-[var(--bg)] px-1.5 py-0.5 text-[8px] font-bold uppercase text-[var(--text)]">Aktif</span>}
                              </span>
                              <span className="mt-0.5 block text-[10px] font-medium opacity-80">
                                {account.type === 'group' ? `Komunitas${account.memberCount != null ? ` · ${account.memberCount.toLocaleString()} member` : ''}` : 'Akun user'}
                              </span>
                              {capacity > 0 && (
                                <span className="mt-2 block">
                                  <span className="flex justify-between text-[9px] font-bold uppercase opacity-70">
                                    <span>Kuota audio</span>
                                    <span>{usage.toLocaleString()} / {capacity.toLocaleString()}</span>
                                  </span>
                                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full border border-[var(--text)] bg-[var(--bg)]">
                                    <span className="block h-full bg-[var(--accent)]" style={{ width: `${percentage}%` }} />
                                  </span>
                                </span>
                              )}
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeleteAccount(account.id);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  onDeleteAccount(account.id);
                                }
                              }}
                              className="rounded-md p-1 text-[var(--text-30)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--danger)] hover:text-white focus:opacity-100"
                              aria-label={`Hapus ${account.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={onAddAccount}
                    className="mt-2 flex w-full items-center gap-2 border-t-2 border-[var(--text)] px-2.5 pt-3 pb-2 text-xs font-bold uppercase tracking-wide text-[var(--accent)] transition hover:text-[var(--accent-deep)]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah akun
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
