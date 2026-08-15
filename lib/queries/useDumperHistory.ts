'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface DumperRecord {
  id: string;
  code: string;
  output: string;
  engineUsed: string;
  executionTimeMs?: number;
  createdAt: string;
}

const LOCAL_KEY = 's2_dumper_history';

function getLocalHistory(): DumperRecord[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
}

function setLocalHistory(records: DumperRecord[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(records.slice(0, 50)));
}

export function useDumperHistory() {
  return useQuery<DumperRecord[]>({
    queryKey: ['dumper-history'],
    queryFn: async () => {
      const local = getLocalHistory();
      const { data, error } = await supabase
        .from('dumper_history')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return local;
      const remote = (data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        code: String(r.code || ''),
        output: String(r.output || ''),
        engineUsed: String(r.engine_used || ''),
        executionTimeMs: r.execution_time_ms ? Number(r.execution_time_ms) : undefined,
        createdAt: String(r.created_at || new Date().toISOString()),
      }));
      const merged = [...new Map([...remote, ...local].map((r) => [r.id, r])).values()];
      return merged.slice(0, 50);
    },
    refetchInterval: 30000,
  });
}

export function useAddDumperRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: {
      code: string;
      output: string;
      engineUsed: string;
      executionTimeMs?: number;
    }) => {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const entry: DumperRecord = { id, ...record, createdAt };
      const local = getLocalHistory();
      setLocalHistory([entry, ...local]);
      await supabase.from('dumper_history').upsert({
        id,
        code: record.code,
        output: record.output,
        engine_used: record.engineUsed,
        execution_time_ms: record.executionTimeMs || null,
        created_at: createdAt,
      });
      return entry;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dumper-history'] }),
  });
}

export function useDeleteDumperRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const local = getLocalHistory().filter((r) => r.id !== id);
      setLocalHistory(local);
      await supabase.from('dumper_history').delete().eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dumper-history'] }),
  });
}

export function useClearDumperHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      localStorage.removeItem(LOCAL_KEY);
      await supabase.from('dumper_history').delete().neq('id', '');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dumper-history'] }),
  });
}