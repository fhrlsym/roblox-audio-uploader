'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getSelectedAccount } from '../stores/accountStore';
import { useAccountStore } from '../stores/accountStore';

export interface UploadRecord {
  id: string;
  assetId: string;
  name: string;
  status: 'Active' | 'Pending' | 'Failed' | 'Copyright';
  originalSpeed: number;
  amplify: number;
  robloxPlaybackSpeed: number;
  youtubeUrl?: string;
  accountName?: string;
  uploadedAt: string;
}

function cleanSongTitle(name: string): string {
  return name.replace(/\.(mp3|wav|flac|ogg)$/i, '').replace(/[_-]/g, ' ').trim();
}

export function useUploadHistory(unlocked: boolean) {
  return useQuery<UploadRecord[]>({
    queryKey: ['upload-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audio_uploads')
        .select('*')
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      const accounts = useAccountStore.getState().accounts;
      return (data || []).map((r: Record<string, unknown>) => {
        let originalSpeed = Number(r.original_speed) || 1;
        if (originalSpeed === 1 && r.name) {
          const match = String(r.name).match(/_(\d+(?:\.\d+)?)x/i);
          if (match) originalSpeed = parseFloat(match[1]);
        }
        let robloxPlaybackSpeed = Number(r.roblox_playback_speed) || 0;
        if (!robloxPlaybackSpeed || robloxPlaybackSpeed === 1) {
          robloxPlaybackSpeed = 1 / originalSpeed;
        }
        const accountId = r.account_id ? String(r.account_id) : null;
        let accountName: string | undefined;
        if (r.account_name) {
          accountName = String(r.account_name);
        } else if (accountId) {
          const acc = accounts.find((a) => a.id === accountId);
          accountName = acc?.displayName || acc?.name || undefined;
        }
        return {
          id: String(r.id),
          assetId: String(r.asset_id || ''),
          name: cleanSongTitle(String(r.name || '')),
          status: (r.status || 'Pending') as UploadRecord['status'],
          originalSpeed,
          amplify: Number(r.amplify || 0),
          robloxPlaybackSpeed,
          youtubeUrl: r.youtube_url ? String(r.youtube_url) : undefined,
          accountName,
          uploadedAt: String(r.uploaded_at || new Date().toISOString()),
        };
      });
    },
    enabled: unlocked,
    refetchInterval: 30000,
  });
}

export function useUploadSuccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: {
      assetId: string;
      name: string;
      speed: number;
      amplify: number;
      accountId?: string;
      accountName?: string;
      youtubeUrl?: string;
    }) => {
      const { error } = await supabase.from('audio_uploads').insert({
        asset_id: record.assetId,
        name: record.name,
        status: 'Active',
        original_speed: record.speed,
        amplify: record.amplify,
        roblox_playback_speed: 1 / record.speed,
        account_id: record.accountId || null,
        account_name: record.accountName || null,
        youtube_url: record.youtubeUrl || null,
        uploaded_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['upload-history'] }),
  });
}

export function useRefreshStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assetId: string) => {
      const account = getSelectedAccount();
      if (!account) throw new Error('No account selected');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/api/asset-status/${assetId}?apiKey=${encodeURIComponent(account.apiKey)}`
      );
      if (!res.ok) throw new Error('Failed to check status');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['upload-history'] }),
  });
}

export function useClearHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('audio_uploads').delete().neq('id', '');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['upload-history'] }),
  });
}