'use client';

import { useCallback, useEffect, useState } from 'react';

export type ThemeName = 'default' | 'gold' | 'emerald' | 'royal' | 'ocean' | 'graphite' | 'sunset' | 'rose' | 'mint';
export type ThemeMode = 'light';

const SETTINGS_KEY = 'audioUploader_settings';

export interface ThemeState {
  theme: ThemeName;
  mode: ThemeMode;
}

function readSettings(): Partial<ThemeState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as Partial<ThemeState>) : {};
  } catch {
    return {};
  }
}

function resolveTheme(): ThemeName {
  const saved = readSettings();
  const valid: ThemeName[] = ['default', 'gold', 'emerald', 'royal', 'ocean', 'graphite', 'sunset', 'rose', 'mint'];
  return valid.includes(saved.theme as ThemeName) ? (saved.theme as ThemeName) : 'default';
}

function apply(theme: ThemeName) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-mode', 'light');
}

function persist(state: ThemeState) {
  try {
    const current = readSettings();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, theme: state.theme, mode: 'light' }));
  } catch {
    // ignore
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>('default');

  useEffect(() => {
    // Hydrate from settings (always light mode now)
    const t = resolveTheme();
    setTheme(t);
    apply(t);
  }, []);

  const changeTheme = useCallback((next: ThemeName) => {
    setTheme(next);
    apply(next);
    persist({ theme: next, mode: 'light' });
  }, []);

  // Keep 'light' mode only — setMode is a no-op kept for API compat
  const setMode = useCallback((_next: ThemeMode) => {
    // no-op: dark mode removed
  }, []);

  return { theme, mode: 'light' as ThemeMode, setTheme: changeTheme, setMode };
}
