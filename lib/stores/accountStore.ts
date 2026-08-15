import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SavedAccount {
  id: string;
  type: 'user' | 'group';
  name: string;
  displayName?: string | null;
  thumbnail?: string | null;
  audioUsage?: number;
  audioCapacity?: number;
  apiKey: string;
}

interface AccountState {
  accounts: SavedAccount[];
  selectedAccountId: string | null;
  setAccounts: (accounts: SavedAccount[]) => void;
  addAccount: (account: SavedAccount) => void;
  removeAccount: (id: string) => void;
  selectAccount: (id: string | null) => void;
  updateQuota: (id: string, usage: number, capacity: number) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      accounts: [],
      selectedAccountId: null,
      setAccounts: (accounts) => set({ accounts }),
      addAccount: (account) =>
        set((state) => ({ accounts: [...state.accounts.filter((a) => a.id !== account.id), account] })),
      removeAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
          selectedAccountId: state.selectedAccountId === id ? null : state.selectedAccountId,
        })),
      selectAccount: (id) => set({ selectedAccountId: id }),
      updateQuota: (id, usage, capacity) =>
        set((state) => ({
          accounts: state.accounts.map((a) => (a.id === id ? { ...a, audioUsage: usage, audioCapacity: capacity } : a)),
        })),
    }),
    { name: 's2_accounts' }
  )
);

export const getSelectedAccount = () => {
  const state = useAccountStore.getState();
  return state.accounts.find((a) => a.id === state.selectedAccountId) || null;
};