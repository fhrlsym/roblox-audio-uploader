import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../supabase';

export interface SavedAccount {
  id: string;
  type: 'user' | 'group';
  name: string;
  displayName?: string | null;
  thumbnail?: string | null;
  audioUsage?: number;
  audioCapacity?: number;
  apiKey: string;
  userId?: string;
  groupId?: string;
}

interface AccountState {
  accounts: SavedAccount[];
  selectedAccountId: string | null;
  loaded: boolean;
  setAccounts: (accounts: SavedAccount[]) => void;
  addAccount: (account: SavedAccount) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  selectAccount: (id: string | null) => void;
  updateQuota: (id: string, usage: number, capacity: number) => void;
  loadFromSupabase: () => Promise<void>;
}

function saveApiKeyLegacy(id: string, apiKey: string) {
  try {
    const keys = JSON.parse(localStorage.getItem('audioUploader_apiKeys') || '{}');
    keys[id] = apiKey;
    localStorage.setItem('audioUploader_apiKeys', JSON.stringify(keys));
  } catch {}
}

function removeApiKeyLegacy(id: string) {
  try {
    const keys = JSON.parse(localStorage.getItem('audioUploader_apiKeys') || '{}');
    delete keys[id];
    localStorage.setItem('audioUploader_apiKeys', JSON.stringify(keys));
  } catch {}
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      accounts: [],
      selectedAccountId: null,
      loaded: false,
      setAccounts: (accounts) => set({ accounts, loaded: true }),
      addAccount: async (account) => {
        saveApiKeyLegacy(account.id, account.apiKey);
        try {
          await supabase.from('saved_accounts').upsert({
            id: account.id,
            type: account.type,
            name: account.name,
            display_name: account.displayName || null,
            thumbnail: account.thumbnail || null,
            audio_usage: account.audioUsage ?? null,
            audio_capacity: account.audioCapacity ?? null,
            api_key: account.apiKey,
            owner_id: account.userId || null,
          });
        } catch {}
        set((state) => ({ accounts: [...state.accounts.filter((a) => a.id !== account.id), account] }));
      },
      removeAccount: async (id) => {
        removeApiKeyLegacy(id);
        try {
          await supabase.from('saved_accounts').delete().eq('id', id);
        } catch {}
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
          selectedAccountId: state.selectedAccountId === id ? null : state.selectedAccountId,
        }));
      },
      selectAccount: (id) => {
        if (id) {
          localStorage.setItem('audioUploader_selectedAccountId', id);
        } else {
          localStorage.removeItem('audioUploader_selectedAccountId');
        }
        set({ selectedAccountId: id });
      },
      updateQuota: (id, usage, capacity) =>
        set((state) => ({
          accounts: state.accounts.map((a) => (a.id === id ? { ...a, audioUsage: usage, audioCapacity: capacity } : a)),
        })),
      loadFromSupabase: async () => {
        if (get().loaded) return;
        try {
          const legacyKeys = JSON.parse(localStorage.getItem('audioUploader_apiKeys') || '{}');
          const legacySelected = localStorage.getItem('audioUploader_selectedAccountId');

          const { data, error } = await supabase
            .from('saved_accounts')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && data) {
            const accounts: SavedAccount[] = data.map((row: Record<string, unknown>) => ({
              id: String(row.id),
              type: (row.type === 'group' ? 'group' : 'user') as 'user' | 'group',
              name: String(row.name || row.display_name || 'Roblox Account'),
              displayName: row.display_name ? String(row.display_name) : undefined,
              thumbnail: row.thumbnail ? String(row.thumbnail) : null,
              audioUsage: row.audio_usage ? Number(row.audio_usage) : undefined,
              audioCapacity: row.audio_capacity ? Number(row.audio_capacity) : undefined,
              apiKey: String(legacyKeys[String(row.id)] || row.api_key || ''),
              userId: row.owner_id ? String(row.owner_id) : undefined,
              groupId: row.type === 'group' ? String(row.id) : undefined,
            }));
            set({ accounts, loaded: true });
            if (legacySelected && accounts.some((a) => a.id === legacySelected)) {
              set({ selectedAccountId: legacySelected });
            } else if (accounts.length > 0 && !legacySelected) {
              set({ selectedAccountId: accounts[0].id });
            }
          } else {
            set({ loaded: true });
          }
        } catch {
          set({ loaded: true });
        }
      },
    }),
    {
      name: 's2_accounts',
      partialize: (state) => ({
        accounts: state.accounts,
        selectedAccountId: state.selectedAccountId,
      }),
    }
  )
);

export const getSelectedAccount = () => {
  const state = useAccountStore.getState();
  return state.accounts.find((a) => a.id === state.selectedAccountId) || null;
};