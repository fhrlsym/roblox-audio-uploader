'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UploadRecord, UploadStats, SavedAccount } from '../types/audio';
import { cleanSongTitle } from '../lib/utils';

// Supabase/PostgREST caps each request at 1000 rows by default, so history is
// fetched in pages and appended on demand instead of relying on a single select.
const PAGE_SIZE = 500;

export function useUploadHistory(unlocked: boolean, backendUrl: string, selectedAccountRef: React.MutableRefObject<SavedAccount | null>) {
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);
  const [uploadStats, setUploadStats] = useState<UploadStats>({ total: 0, active: 0, pending: 0, failed: 0, copyright: 0 });
  const [refreshingIds, setRefreshingIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const statusRefreshLockRef = useRef(false);
  const accountsRef = useRef<SavedAccount[]>([]);

  const setKnownAccounts = (accounts: SavedAccount[]) => {
    accountsRef.current = accounts;
  };

  const resolveAccountName = useCallback((accountId?: string): string => {
    if (!accountId) {
      return selectedAccountRef.current?.name || 'Roblox';
    }
    const found = accountsRef.current.find((a) => a.id === accountId);
    return found?.name || 'Roblox';
  }, [selectedAccountRef]);

  const mapRow = useCallback((row: Record<string, unknown>): UploadRecord => {
    let originalSpeed = Number(row.original_speed) || 1;
    if (originalSpeed === 1 && row.name) {
      const match = String(row.name).match(/_(\d+(?:\.\d+)?)x/i);
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
      id: String(row.id),
      fileName: cleanSongTitle(String(row.name ?? '')),
      displayName: cleanSongTitle(String(row.name ?? '')),
      assetId: String(row.asset_id ?? ''),
      accountId: String(row.account_id || ''),
      accountName: resolveAccountName(String(row.account_id || '')) || 'Roblox',
      uploadedAt: new Date(String(row.uploaded_at)).getTime(),
      robloxPlaybackSpeed: robloxSpeed,
      originalSpeed: originalSpeed,
      amplify: row.amplify as number | undefined,
      status: (row.status as string) || 'Pending',
    };
  }, [resolveAccountName]);

  const loadUploadStats = useCallback(async () => {
    try {
      const countFor = (status?: string) => {
        let query = supabase
          .from('audio_uploads')
          .select('*', { count: 'exact', head: true });
        if (status) query = query.eq('status', status);
        return query;
      };

      const [totalRes, activeRes, pendingRes, failedRes, copyrightRes] = await Promise.all([
        countFor(),
        countFor('Active'),
        countFor('Pending'),
        countFor('Failed'),
        countFor('Copyright'),
      ]);

      setUploadStats({
        total: totalRes.count ?? 0,
        active: activeRes.count ?? 0,
        pending: pendingRes.count ?? 0,
        failed: failedRes.count ?? 0,
        copyright: copyrightRes.count ?? 0,
      });
    } catch {
      // ignore; stats are non-critical
    }
  }, []);

  const loadUploadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('audio_uploads')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (!error && data) {
        setUploadHistory(data.map(mapRow));
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
    // Stats reflect the whole table, independent of the page loaded above.
    await loadUploadStats();
  }, [mapRow, loadUploadStats]);

  const loadMoreUploadHistory = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const offset = uploadHistory.length;
      const { data, error } = await supabase
        .from('audio_uploads')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (!error && data) {
        setUploadHistory((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...data.map(mapRow).filter((r) => !seen.has(r.id))];
        });
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, uploadHistory.length, mapRow]);

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

      const changed: { assetId: string; status: string }[] = [];

      const tasks = data.map(async (row) => {
        try {
          const response = await fetch(`${backendUrl}/api/asset-status/${row.asset_id}${query}`);
          const result = await response.json();
          const status = result.status;
          if (status !== 'Pending' && status !== row.status) {
            await updateAssetStatus(row.asset_id, status);
            changed.push({ assetId: row.asset_id, status });
          }
        } catch {
          // A single failed row must not abort the sweep (or produce unhandled rejections)
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

      // Patch changed rows in place instead of reloading, so pagination is preserved.
      if (changed.length > 0) {
        const byId = new Map(changed.map((c) => [c.assetId, c.status]));
        setUploadHistory((prev) =>
          prev.map((item) =>
            byId.has(item.assetId) && item.status !== byId.get(item.assetId)
              ? { ...item, status: byId.get(item.assetId)! }
              : item
          )
        );
        await loadUploadStats();
      }
    } catch {
      // ignore network/Supabase failures; the next 5s sweep will retry
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
  }, [unlocked, loadUploadHistory]);

  return {
    uploadHistory,
    uploadStats,
    refreshingIds,
    isLoading,
    isLoadingMore,
    hasMore,
    setKnownAccounts,
    loadUploadHistory,
    loadMoreUploadHistory,
    handleRefreshStatus,
    refreshPendingStatuses,
    handleUploadSuccess,
    handleClearHistory,
  };
}
