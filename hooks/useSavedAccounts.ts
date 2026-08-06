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
        const cookies = JSON.parse(localStorage.getItem('audioUploader_cookies') || '{}');

        const accounts: SavedAccount[] = data.map((row) => ({
          id: row.id,
          name: row.name || row.display_name || 'Akun Roblox',
          type: row.type,
          apiKey: row.api_key || apiKeys[row.id] || '',
          cookie: row.cookie || cookies[row.id] || '',
          userId: row.owner_id,
          groupId: row.type === 'group' ? row.id : undefined,
          displayName: row.display_name || undefined,
          memberCount: row.member_count ?? undefined,
          hasVerifiedBadge: row.has_verified_badge ?? false,
          thumbnail: row.thumbnail || null,
          ownerName: row.owner_name || null,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
        }));

        setSavedAccounts(accounts);
        accountsRef.current = accounts;

        const rememberId = localStorage.getItem('audioUploader_selectedAccountId');
        const found = accounts.find((a) => a.id === rememberId);
        const activeAcc = found || accounts[0] || null;

        setSelectedAccount(activeAcc);
        if (activeAcc) {
          localStorage.setItem('audioUploader_selectedAccountId', activeAcc.id);
        }

        // Isi kuota untuk semua akun sekaligus (agar tiap akun tampil kuotanya di dropdown)
        const withQuota = await Promise.all(
          accounts.map(async (a) => ({ ...a, quota: await fetchQuota(a) }))
        );
        setSavedAccounts(withQuota);
        accountsRef.current = withQuota;
        setSelectedAccount((prev) =>
          prev ? withQuota.find((a) => a.id === prev.id) || prev : withQuota[0] || null
        );
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

  const upsertAccountRow = async (account: SavedAccount) => {
    const payload = {
      id: account.id,
      type: account.type,
      name: account.name,
      display_name: account.displayName || null,
      member_count: account.memberCount ?? null,
      has_verified_badge: account.hasVerifiedBadge ?? false,
      thumbnail: account.thumbnail ?? null,
      owner_id: account.userId ?? null,
      owner_name: account.ownerName ?? null,
      api_key: account.apiKey || null,
      cookie: account.cookie || null,
      audio_usage: account.quota?.usage ?? null,
      audio_capacity: account.quota?.capacity ?? null,
    };
    const { error } = await supabase
      .from('saved_accounts')
      .upsert(payload, { onConflict: 'id,type' });
    if (error) {
      console.warn('Supabase upsert fallback:', error.message);
      const { error: insertErr } = await supabase.from('saved_accounts').insert(payload);
      if (insertErr) console.warn('Supabase insert failed:', insertErr.message);
    }
  };

  const handleAccountAdded = async (account: SavedAccount) => {
    // Simpan apiKey & cookie ke localStorage (fallback jika DB read-only)
    const apiKeys = JSON.parse(localStorage.getItem('audioUploader_apiKeys') || '{}');
    apiKeys[account.id] = account.apiKey;
    localStorage.setItem('audioUploader_apiKeys', JSON.stringify(apiKeys));
    if (account.cookie) {
      const cookies = JSON.parse(localStorage.getItem('audioUploader_cookies') || '{}');
      cookies[account.id] = account.cookie;
      localStorage.setItem('audioUploader_cookies', JSON.stringify(cookies));
    }
    // Simpan ke Supabase supaya persist saat refresh
    try {
      await upsertAccountRow(account);
    } catch {
      // tetap berjalan walau DB gagal (masih bisa di-localStorage)
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
