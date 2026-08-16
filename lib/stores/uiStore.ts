import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeId = 'system' | 'gold-dark' | 'light' | 'emerald' | 'royal' | 'ocean' | 'graphite';
export type ToolId = 'audio-master' | 'spoofer' | 'dumper' | 'obfuscator';

interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface UIState {
  theme: ThemeId;
  activeTool: ToolId;
  unlocked: boolean;
  youtubeCookies: string;
  toasts: ToastItem[];
  setTheme: (theme: ThemeId) => void;
  setActiveTool: (tool: ToolId) => void;
  setUnlocked: (v: boolean) => void;
  setYoutubeCookies: (c: string) => void;
  addToast: (message: string, type?: ToastItem['type']) => void;
  removeToast: (id: number) => void;
}

let toastId = 0;

function migrateLegacyTheme(): ThemeId {
  try {
    const raw = localStorage.getItem('audioUploader_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.theme) return parsed.theme as ThemeId;
    }
  } catch {}
  return 'gold-dark';
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: migrateLegacyTheme(),
      activeTool: 'audio-master',
      unlocked: false,
      youtubeCookies: '',
      toasts: [],
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
      },
      setActiveTool: (tool) => set({ activeTool: tool }),
      setUnlocked: (v) => set({ unlocked: v }),
      setYoutubeCookies: (c) => set({ youtubeCookies: c }),
      addToast: (message, type = 'info') => {
        const id = ++toastId;
        set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
        setTimeout(() => {
          set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
        }, 4000);
      },
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 's2_ui',
      partialize: (state) => ({
        theme: state.theme,
        activeTool: state.activeTool,
        youtubeCookies: state.youtubeCookies,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          document.documentElement.setAttribute('data-theme', state.theme);
        }
      },
    }
  )
);