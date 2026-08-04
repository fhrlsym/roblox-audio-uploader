'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Moon, Sun } from 'lucide-react';
import { RawAudioFile, TunedAudioFile } from '../types/audio';
import InputSection from '../components/InputSection';
import TuningSection from '../components/TuningSection';
import OutputSection from '../components/OutputSection';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const CORRECT_PIN = process.env.NEXT_PUBLIC_PIN || '515753';
const SETTINGS_KEY = 'audioUploader_settings';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface SavedAccount {
  id: string;
  name: string;
  type: 'user' | 'group';
  apiKey: string;
  groupId?: string;
}

export default function Home() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [theme, setTheme] = useState<'dark' | 'sunset' | 'gold'>('dark');
  const [youtubeCookies, setYoutubeCookies] = useState('');
  
  // State management baru
  const [rawFiles, setRawFiles] = useState<RawAudioFile[]>([]);
  const [tunedFiles, setTunedFiles] = useState<TunedAudioFile[]>([]);
  
  // Roblox accounts
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(null);

  // Load settings
  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setTheme(data.theme || 'dark');
        setYoutubeCookies(data.youtubeCookies || '');
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }

    // Load saved accounts
    loadSavedAccounts();
  }, []);

  // Save settings
  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ theme, youtubeCookies })
    );
  }, [theme, youtubeCookies]);

  const loadSavedAccounts = async () => {
    try {
      const { data, error } = await supabase.from('saved_accounts').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        const accounts: SavedAccount[] = data.map((row: any) => ({
          id: row.id,
          name: row.account_name,
          type: row.creator_type,
          apiKey: row.api_key_encrypted,
          groupId: row.group_id,
        }));
        setSavedAccounts(accounts);
        if (accounts.length > 0 && !selectedAccount) {
          setSelectedAccount(accounts[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load accounts:', e);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      setUnlocked(true);
      setPin('');
    } else {
      alert('Invalid PIN');
    }
  };

  const themeClasses = {
    dark: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',
    sunset: 'bg-gradient-to-br from-orange-950 via-slate-900 to-purple-950',
    gold: 'bg-gradient-to-br from-yellow-950 via-slate-900 to-amber-950',
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700 max-w-md w-full">
          <h1 className="text-3xl font-bold text-white mb-6 text-center">S2 Studio</h1>
          <p className="text-slate-400 mb-6 text-center">Enter PIN to access</p>
          <form onSubmit={handlePinSubmit}>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              className="w-full bg-slate-900 text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none mb-4"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses[theme]} p-4 md:p-8`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">S2 Studio</h1>
            <p className="text-slate-400">Audio Master to Roblox</p>
          </div>
          
          {/* Theme Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setTheme('dark')}
              className={`p-3 rounded-lg transition ${theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'}`}
              title="Dark"
            >
              <Moon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTheme('sunset')}
              className={`p-3 rounded-lg transition ${theme === 'sunset' ? 'bg-orange-700 text-white' : 'bg-slate-800 text-slate-400'}`}
              title="Sunset"
            >
              🌅
            </button>
            <button
              onClick={() => setTheme('gold')}
              className={`p-3 rounded-lg transition ${theme === 'gold' ? 'bg-yellow-700 text-white' : 'bg-slate-800 text-slate-400'}`}
              title="Gold"
            >
              ✨
            </button>
          </div>
        </div>

        {/* Account Selector */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 mb-6 shadow-xl border border-slate-700">
          <label className="text-slate-300 font-medium mb-2 block">Roblox Account</label>
          <select
            value={selectedAccount?.id || ''}
            onChange={(e) => {
              const account = savedAccounts.find((a) => a.id === e.target.value);
              setSelectedAccount(account || null);
            }}
            className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
          >
            {savedAccounts.length === 0 && <option value="">No accounts saved</option>}
            {savedAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.type})
              </option>
            ))}
          </select>
          <p className="text-slate-500 text-sm mt-2">
            Manage accounts in database (Supabase saved_accounts table)
          </p>
        </div>

        {/* YouTube Cookies */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 mb-6 shadow-xl border border-slate-700">
          <label className="text-slate-300 font-medium mb-2 block">YouTube Cookies (optional)</label>
          <textarea
            value={youtubeCookies}
            onChange={(e) => setYoutubeCookies(e.target.value)}
            placeholder="Paste Netscape cookies format..."
            className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none h-24 text-sm"
          />
        </div>

        {/* 3 Main Sections */}
        <div className="space-y-6">
          <InputSection
            onFilesAdded={(files) => setRawFiles((prev) => [...prev, ...files])}
            backendUrl={BACKEND_URL}
            youtubeCookies={youtubeCookies}
          />

          <TuningSection
            rawFiles={rawFiles}
            onTuningComplete={(tuned) => setTunedFiles((prev) => [...prev, ...tuned])}
            onRemoveRaw={(id) => setRawFiles((prev) => prev.filter((f) => f.id !== id))}
          />

          <OutputSection
            tunedFiles={tunedFiles}
            onRemoveTuned={(id) => setTunedFiles((prev) => prev.filter((f) => f.id !== id))}
            backendUrl={BACKEND_URL}
            selectedAccount={selectedAccount}
          />
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>S2 Studio — Audio Master to Roblox</p>
          <p>Created by fhrlsym</p>
          <p className="text-xs mt-2">
            backend: <span className="font-mono text-slate-400">{BACKEND_URL}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
