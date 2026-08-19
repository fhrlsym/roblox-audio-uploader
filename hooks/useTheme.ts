'use client';

import { useCallback, useEffect, useState } from 'react';

export type ThemeName = 'default' | 'gold' | 'emerald' | 'royal' | 'ocean' | 'graphite';
export type ThemeMode = 'light' | 'dark' | 'system';

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
  const valid: ThemeName[] = ['default', 'gold', 'emerald', 'royal', 'ocean', 'graphite'];
  return valid.includes(saved.theme as ThemeName) ? (saved.theme as ThemeName) : 'default';
}

function resolveMode(): ThemeMode {
  const saved = readSettings();
  const valid: ThemeMode[] = ['light', 'dark', 'system'];
  return valid.includes(saved.mode as ThemeMode) ? (saved.mode as ThemeMode) : 'light';
}

function apply(theme: ThemeName, mode: ThemeMode) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-mode', mode);
}

function persist(state: ThemeState) {
  try {
    const current = readSettings();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, theme: state.theme, mode: state.mode }));
  } catch {
    // ignore
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>('default');
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    // Hydrate from settings (defaults to light)
    const t = resolveTheme();
    const m = resolveMode();
    setTheme(t);
    setMode(m);
    apply(t, m);
  }, []);

  const changeTheme = useCallback((next: ThemeName) => {
    setTheme(next);
    apply(next, mode);
    persist({ theme: next, mode });
  }, [mode]);

  const changeMode = useCallback((next: ThemeMode) => {
    setMode(next);
    apply(theme, next);
    persist({ theme, mode: next });
  }, [theme]);

  // Keep data-mode in sync for 'system' (re-applied on OS change is handled by CSS media queries)
  return { theme, mode, setTheme: changeTheme, setMode: changeMode };
}
