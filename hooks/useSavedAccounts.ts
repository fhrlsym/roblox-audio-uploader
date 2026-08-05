'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SavedAccount, RobloxQuota } from '../types/audio';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export function useSavedAccounts(unlocked: boolean, backendUrl: string) {
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const selectedAccountRef = useRef<SavedAccount | null>(null);
  const accountsRef = useRef<SavedAccount[]>([]);

  useEffect(() => {
    selectedAccountRef.current = selectedAccount;
  }, [selectedAccount]);

  useEffect(() => {
    accountsRef.current = savedAccounts;
  }, [savedAccounts]);

  const fetchQuota = async (account: SavedAccount): Promise<RobloxQuota | null> => {
    if (!account.apiKey || !account.userId) return null;
    try {
      const isGroup = account.type === 'group';
      const targetId = isGroup ? account.groupId || account.id : account.userId;
      const res = await fetch(
        `${backendUrl}/api/roblox-quota?apiKey=${encodeURIComponent(account.apiKey)}&targetId=${targetId}&targetType=${account.type}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return {
        usage: data.usage ?? 0,
        capacity: data.capacity ?? 0,
        period: data.period || '',
      };
    } catch {
      return null;
    }
  };

  const loadSavedAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const apiKeys = JSON.parse(localStorage.getItem('audioUploader_apiKeys') || '{}');

        const accounts: SavedAccount[] = data.map((row) => ({
          id: row.id,
          name: row.display_name || row.name,
          type: row.type,
          apiKey: row.api_key || apiKeys[row.id] || '',
          userId: row.owner_id,
          groupId: row.type === 'group' ? row.id : undefined,
          displayName: row.display_name || undefined,
          memberCount: row.member_count ?? undefined,
          hasVerifiedBadge: row.has_verified_badge ?? false,
          thumbnail: row.thumbnail || null,
          ownerName: row.owner_name || null,
        }));

        setSavedAccounts(accounts);

        const rememberId = localStorage.getItem('audioUploader_selectedAccountId');
        const found = accounts.find((a) => a.id === rememberId);
        const activeAcc = found || accounts[0] || null;

        if (activeAcc) {
          setSelectedAccount(activeAcc);
          const q = await fetchQuota(activeAcc);
          if (q) {
            setSelectedAccount((prev) => (prev && prev.id === activeAcc.id ? { ...prev, quota: q } : prev));
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const refreshAccountQuotas = async () => {
    const list = accountsRef.current;
    if (list.length === 0) return;
    const updated = await Promise.all(
      list.map(async (acc) => {
        const q = await fetchQuota(acc);
        return { ...acc, quota: q };
      })
    );
    setSavedAccounts(updated);
    if (selectedAccountRef.current) {
      const match = updated.find((a) => a.id === selectedAccountRef.current?.id);
      if (match) setSelectedAccount(match);
    }
  };

  const handleAccountAdded = (account: SavedAccount) => {
    setSavedAccounts((prev) => [account, ...prev.filter((a) => a.id !== account.id)]);
    setSelectedAccount(account);
    localStorage.setItem('audioUploader_selectedAccountId', account.id);
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      await supabase.from('saved_accounts').delete().eq('id', id);
      setSavedAccounts((prev) => {
        const next = prev.filter((a) => a.id !== id);
        if (selectedAccount?.id === id) {
          const newActive = next[0] || null;
          setSelectedAccount(newActive);
          if (newActive) localStorage.setItem('audioUploader_selectedAccountId', newActive.id);
          else localStorage.removeItem('audioUploader_selectedAccountId');
        }
        return next;
      });
    } catch {
      // ignore
    }
  };

  const selectAccount = (account: SavedAccount) => {
    setSelectedAccount(account);
    localStorage.setItem('audioUploader_selectedAccountId', account.id);
    setAccountMenuOpen(false);
  };

  useEffect(() => {
    if (unlocked) {
      loadSavedAccounts();
    }
  }, [unlocked]);

  return {
    savedAccounts,
    selectedAccount,
    showAccountModal,
    setShowAccountModal,
    accountMenuOpen,
    setAccountMenuOpen,
    selectedAccountRef,
    loadSavedAccounts,
    refreshAccountQuotas,
    handleAccountAdded,
    handleDeleteAccount,
    selectAccount,
  };
}
