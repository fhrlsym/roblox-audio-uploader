'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { UploadRecord, UploadStats, SavedAccount } from '../types/audio';
import { cleanSongTitle } from '../lib/utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export function useUploadHistory(unlocked: boolean, backendUrl: string, selectedAccountRef: React.MutableRefObject<SavedAccount | null>) {
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);
  const [uploadStats, setUploadStats] = useState<UploadStats>({ total: 0, active: 0, pending: 0, failed: 0, copyright: 0 });
  const [refreshingIds, setRefreshingIds] = useState<string[]>([]);
  const statusRefreshLockRef = useRef(false);
  const accountsRef = useRef<SavedAccount[]>([]);

  const setKnownAccounts = (accounts: SavedAccount[]) => {
    accountsRef.current = accounts;
  };

  const resolveAccountName = (accountId?: string): string => {
    if (!accountId) {
      return selectedAccountRef.current?.name || 'Roblox';
    }
    const found = accountsRef.current.find((a) => a.id === accountId);
    return found?.name || 'Roblox';
  };

  const loadUploadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('audio_uploads')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(300);

      if (!error && data) {
        const history: UploadRecord[] = data.map((row) => {
          let originalSpeed = Number(row.original_speed) || 1;
          if (originalSpeed === 1 && row.name) {
            const match = row.name.match(/_(\d+(?:\.\d+)?)x/i);
            if (match && match[1]) {
              originalSpeed = parseFloat(match[1]);
            }
          }

          let robloxSpeed: string | undefined = undefined;
          if (row.roblox_playback_speed && Number(row.roblox_playback_speed) > 0 && Number(row.roblox_playback_speed) !== 1) {
            robloxSpeed = Number(row.roblox_playback_speed).toFixed(4);
          } else if (originalSpeed > 0) {
            robloxSpeed = (1 / originalSpeed).toFixed(4);
          }

          return {
            id: row.id,
            fileName: cleanSongTitle(row.name),
            displayName: cleanSongTitle(row.name),
            assetId: row.asset_id,
            accountId: row.account_id || '',
            accountName: resolveAccountName(row.account_id || '') || 'Roblox',
            uploadedAt: new Date(row.uploaded_at).getTime(),
            robloxPlaybackSpeed: robloxSpeed,
            originalSpeed: originalSpeed,
            amplify: row.amplify,
            status: row.status || 'Pending',
          };
        });
        setUploadHistory(history);
        setUploadStats({
          total: data.length,
          active: data.filter((d) => d.status === 'Active').length,
          pending: data.filter((d) => d.status === 'Pending').length,
          failed: data.filter((d) => d.status === 'Failed').length,
          copyright: data.filter((d) => d.status === 'Copyright').length,
        });
      }
    } catch {
      // ignore
    }
  };

  const updateAssetStatus = async (assetId: string, status: string) => {
    try {
      await supabase
        .from('audio_uploads')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('asset_id', assetId);
    } catch {
      // ignore
    }
  };

  const handleRefreshStatus = async (assetId: string) => {
    setRefreshingIds((prev) => [...prev, assetId]);
    try {
      const apiKey = selectedAccountRef.current?.apiKey;
      const query = apiKey ? `?apiKey=${encodeURIComponent(apiKey)}` : '';
      const response = await fetch(`${backendUrl}/api/asset-status/${assetId}${query}`);
      const data = await response.json();

      if (data.status) {
        setUploadHistory((prev) =>
          prev.map((item) => (item.assetId === assetId ? { ...item, status: data.status } : item))
        );
        await updateAssetStatus(assetId, data.status);
      }
    } catch {
      // ignore
    } finally {
      setRefreshingIds((prev) => prev.filter((id) => id !== assetId));
    }
  };

  const refreshPendingStatuses = async () => {
    if (statusRefreshLockRef.current) return;
    statusRefreshLockRef.current = true;
    try {
      const { data, error } = await supabase
        .from('audio_uploads')
        .select('*')
        .eq('status', 'Pending');

      if (error || !data || data.length === 0) return;

      const apiKey = selectedAccountRef.current?.apiKey;
      const query = apiKey ? `?apiKey=${encodeURIComponent(apiKey)}` : '';

      const tasks = data.map(async (row) => {
        const response = await fetch(`${backendUrl}/api/asset-status/${row.asset_id}${query}`);
        const result = await response.json();
        const status = result.status;
        if (status !== 'Pending' && status !== row.status) {
          await updateAssetStatus(row.asset_id, status);
        }
      });

      const CONCURRENCY = 3;
      let nextIndex = 0;
      const worker = async () => {
        while (nextIndex < tasks.length) {
          await tasks[nextIndex++];
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));
    } finally {
      statusRefreshLockRef.current = false;
    }
  };

  const handleUploadSuccess = async (record: UploadRecord) => {
    try {
      const robloxSpeed = record.robloxPlaybackSpeed ? Number(record.robloxPlaybackSpeed) : 1;
      await supabase.from('audio_uploads').insert({
        asset_id: record.assetId,
        name: record.fileName,
        status: record.status || 'Pending',
        original_speed: record.originalSpeed || 1,
        amplify: record.amplify || 0,
        roblox_playback_speed: robloxSpeed,
        account_id: selectedAccountRef.current?.id || null,
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await loadUploadHistory();
    } catch {
      // ignore
    }
  };

  const handleClearHistory = async () => {
    try {
      await supabase.from('audio_uploads').delete().neq('id', '');
      setUploadHistory([]);
      setUploadStats({ total: 0, active: 0, pending: 0, failed: 0, copyright: 0 });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (unlocked) {
      loadUploadHistory();
    }
  }, [unlocked]);

  return {
    uploadHistory,
    uploadStats,
    refreshingIds,
    setKnownAccounts,
    loadUploadHistory,
    handleRefreshStatus,
    refreshPendingStatuses,
    handleUploadSuccess,
    handleClearHistory,
  };
}
