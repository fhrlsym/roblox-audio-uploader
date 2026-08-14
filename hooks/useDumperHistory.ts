'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { HttpLogEntry, ConstantEntry } from '../lib/dumper/types';

export interface DumperRecord {
  id: string;
  title: string;
  obfuscator: string;
  engine: string;
  originalLines: number;
  dumpedLines: number;
  constantsCount: number;
  httpLogsCount: number;
  executionTimeMs: number;
  inputSnippet: string;
  inputCode: string;
  dumpedCode: string;
  httpLogs: HttpLogEntry[];
  constants: ConstantEntry[];
  createdAt: number;
}

const STORAGE_KEY = 's2studio_dumperHistory';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export function useDumperHistory() {
  const [records, setRecords] = useState<DumperRecord[]>([]);

  // Load from Supabase Database + LocalStorage Hybrid
  const loadHistory = async () => {
    let localList: DumperRecord[] = [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          localList = parsed;
        }
      }
    } catch {
      // ignore
    }

    // Set local cache first for fast render
    if (localList.length > 0) {
      setRecords(localList);
    }

    // Try fetching from Supabase Database
    try {
      const { data, error } = await supabase
        .from('dumper_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        const dbList: DumperRecord[] = data.map((row: any) => ({
          id: row.id,
          title: row.title || 'Luau Script',
          obfuscator: row.obfuscator || 'Unknown',
          engine: row.engine || 'Universal Sandbox',
          originalLines: Number(row.original_lines) || 0,
          dumpedLines: Number(row.dumped_lines) || 0,
          constantsCount: Number(row.constants_count) || 0,
          httpLogsCount: Number(row.http_logs_count) || 0,
          executionTimeMs: Number(row.execution_time_ms) || 0,
          inputSnippet: row.input_snippet || '',
          inputCode: row.input_code || '',
          dumpedCode: row.dumped_code || '',
          httpLogs: Array.isArray(row.http_logs) ? row.http_logs : [],
          constants: Array.isArray(row.constants) ? row.constants : [],
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        }));

        // Merge DB records and local records
        const map = new Map<string, DumperRecord>();
        for (const item of [...dbList, ...localList]) {
          if (!map.has(item.id)) {
            map.set(item.id, item);
          }
        }
        const merged = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
        setRecords(merged);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore network / table not ready errors
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const saveToStorage = (list: DumperRecord[]) => {
    setRecords(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  };

  const addRecord = async (record: DumperRecord) => {
    const updated = [record, ...records.filter((r) => r.id !== record.id)].slice(0, 50);
    saveToStorage(updated);

    // Sync to Supabase Database in background
    try {
      await supabase.from('dumper_history').upsert(
        {
          id: record.id,
          title: record.title,
          obfuscator: record.obfuscator,
          engine: record.engine,
          original_lines: record.originalLines,
          dumped_lines: record.dumpedLines,
          constants_count: record.constantsCount,
          http_logs_count: record.httpLogsCount,
          execution_time_ms: record.executionTimeMs,
          input_snippet: record.inputSnippet,
          input_code: record.inputCode,
          dumped_code: record.dumpedCode,
          http_logs: record.httpLogs,
          constants: record.constants,
          created_at: new Date(record.createdAt).toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch {
      // ignore if offline / table not created
    }
  };

  const deleteRecord = async (id: string) => {
    const updated = records.filter((r) => r.id !== id);
    saveToStorage(updated);

    try {
      await supabase.from('dumper_history').delete().eq('id', id);
    } catch {
      // ignore
    }
  };

  const clearHistory = async () => {
    saveToStorage([]);
    try {
      await supabase.from('dumper_history').delete().neq('id', '');
    } catch {
      // ignore
    }
  };

  return {
    records,
    addRecord,
    deleteRecord,
    clearHistory,
    refreshHistory: loadHistory,
  };
}
