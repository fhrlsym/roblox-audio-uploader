'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface SpoofRecord {
  id: string;
  assetId: string;
  name?: string;
  assetType?: string;
  newAssetId?: string;
  success: boolean;
  createdAt: string;
}

export function useSpoofHistory() {
  return useQuery<SpoofRecord[]>({
    queryKey: ['spoof-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('spoof_history')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        assetId: String(r.original_asset_id || r.asset_id || ''),
        name: r.title ? String(r.title) : (r.name ? String(r.name) : undefined),
        assetType: r.asset_type ? String(r.asset_type) : undefined,
        newAssetId: r.new_asset_id ? String(r.new_asset_id) : undefined,
        success: r.status === 'Active' || r.status === 'Success' || Boolean(r.success),
        createdAt: String(r.created_at || new Date().toISOString()),
      }));
    },
    refetchInterval: 30000,
  });
}

export function useUpsertSpoof() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: {
      assetId: string;
      name?: string;
      assetType?: string;
      newAssetId?: string;
      success: boolean;
    }) => {
      const { error } = await supabase.from('spoof_history').upsert({
        original_asset_id: record.assetId,
        asset_id: record.assetId,
        title: record.name || null,
        name: record.name || null,
        asset_type: record.assetType || null,
        new_asset_id: record.newAssetId || null,
        status: record.success ? 'Active' : 'Failed',
        success: record.success,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spoof-history'] }),
  });
}

export function useClearSpoofHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('spoof_history').delete().neq('id', '');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spoof-history'] }),
  });
}