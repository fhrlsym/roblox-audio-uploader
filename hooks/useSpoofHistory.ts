'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SpoofRecord } from '../types/audio';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export function useSpoofHistory() {
  const [records, setRecords] = useState<SpoofRecord[]>([]);

  const loadSpoofHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('spoof_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (!error && data) {
        const list: SpoofRecord[] = data.map((row) => ({
          id: row.id,
          originalAssetId: row.original_asset_id,
          newAssetId: row.new_asset_id || undefined,
          assetType: String(row.asset_type || 'Audio'),
          title: row.title,
          status: (row.status || 'Pending') as SpoofRecord['status'],
          error: row.error || undefined,
          createdAt: new Date(row.created_at).getTime(),
        }));
        setRecords(list);
      }
    } catch {
      // ignore
    }
  };

  const upsertRecord = async (record: SpoofRecord) => {
    try {
      await supabase.from('spoof_history').upsert(
        {
          id: record.id,
          original_asset_id: record.originalAssetId,
          new_asset_id: record.newAssetId || null,
          asset_type: record.assetType,
          title: record.title,
          status: record.status,
          error: record.error || null,
          created_at: new Date(record.createdAt).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch {
      // ignore
    }
  };

  const updateRecordStatus = async (id: string, patch: Partial<SpoofRecord>) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const current = records.find((r) => r.id === id);
    if (current) {
      await upsertRecord({ ...current, ...patch });
    }
  };

  const clearHistory = async () => {
    try {
      await supabase.from('spoof_history').delete().neq('id', '');
      setRecords([]);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSpoofHistory();
  }, []);

  return {
    records,
    setRecords,
    loadSpoofHistory,
    upsertRecord,
    updateRecordStatus,
    clearHistory,
  };
}
