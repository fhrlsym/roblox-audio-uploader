'use client';

import { useUIStore, type ThemeId } from '../../lib/stores/uiStore';
import { useAccountStore } from '../../lib/stores/accountStore';
import { Monitor, Palette, ChevronDown, UserCircle2, Music } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: 'system', label: 'System', swatch: 'linear-gradient(135deg, #34d399, #a67c00)' },
  { id: 'gold-dark', label: 'Gold Dark', swatch: 'linear-gradient(135deg, #f0cd6b, #b8912a)' },
  { id: 'light', label: 'Light', swatch: 'linear-gradient(135deg, #ffffff, #e2e8f0)' },
  { id: 'emerald', label: 'Emerald', swatch: 'linear-gradient(135deg, #55e0ab, #1f8f68)' },
  { id: 'royal', label: 'Royal', swatch: 'linear-gradient(135deg, #b0a4ff, #6a58d6)' },
  { id: 'ocean', label: 'Ocean', swatch: 'linear-gradient(135deg, #7dd3fc, #1f8fc9)' },
  { id: 'graphite', label: 'Graphite', swatch: 'linear-gradient(135deg, #cbd5e1, #465368)' },
];

export function TopBar() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const accounts = useAccountStore((s) => s.accounts);
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const selectAccount = useAccountStore((s) => s.selectAccount);

  const [themeOpen, setThemeOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="h-14 border-b border-[var(--line)] bg-[var(--panel)] flex items-center justify-end gap-2 px-4 shrink-0">
      <div className="flex items-center gap-2">
        <div ref={themeRef} className="relative">
          <button
            onClick={() => setThemeOpen(!themeOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-[var(--surface)] text-[var(--text-60)] hover:text-[var(--text)] transition text-sm"
            aria-label="Change theme"
          >
            <Palette size={16} />
            <span className="hidden sm:inline text-xs font-medium">{THEMES.find((t) => t.id === theme)?.label}</span>
          </button>
          {themeOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl py-1 z-50"
              role="menu"
            >
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); setThemeOpen(false); }}
                  role="menuitemradio"
                  aria-checked={theme === t.id}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition ${
                    theme === t.id ? 'text-[var(--accent-strong)] bg-[var(--accent-10)]' : 'text-[var(--text-60)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full border border-[var(--line)]" style={{ background: t.swatch }} />
                  <span>{t.label}</span>
                  {t.id === 'system' && <Monitor size={14} className="ml-auto opacity-50" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div ref={accountRef} className="relative">
          <button
            onClick={() => setAccountOpen(!accountOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-[var(--surface)] text-[var(--text-60)] hover:text-[var(--text)] transition text-sm"
            aria-label="Select account"
          >
            {selectedAccount?.thumbnail ? (
              <img src={selectedAccount.thumbnail} alt="" className="w-6 h-6 rounded-lg object-cover" />
            ) : (
              <UserCircle2 size={20} />
            )}
            <span className="hidden sm:inline text-xs font-medium max-w-[100px] truncate">
              {selectedAccount?.displayName || selectedAccount?.name || 'No account'}
            </span>
            <ChevronDown size={14} />
          </button>
          {accountOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl py-1 z-50">
              {accounts.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-[var(--text-40)]">No accounts yet</div>
              ) : (
                accounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => { selectAccount(acc.id); setAccountOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition ${
                      selectedAccountId === acc.id ? 'text-[var(--accent-strong)] bg-[var(--accent-10)]' : 'text-[var(--text-60)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
                    }`}
                  >
                    {acc.thumbnail ? (
                      <img src={acc.thumbnail} alt="" className="w-7 h-7 rounded-lg object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-[var(--surface-strong)] flex items-center justify-center">
                        <Music size={14} />
                      </div>
                    )}
                    <div className="text-left flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{acc.displayName || acc.name}</div>
                      <div className="text-[10px] text-[var(--text-35)] capitalize">{acc.type}</div>
                    </div>
                  </button>
                ))
              )}
              <div className="border-t border-[var(--line)] mt-1 pt-1">
                <Link
                  href="/accounts"
                  onClick={() => setAccountOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--accent-strong)] hover:bg-[var(--accent-10)] transition"
                >
                  <UserCircle2 size={14} />
                  Manage Accounts
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}