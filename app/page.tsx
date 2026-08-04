'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Moon, Sun } from 'lucide-react';
import { RawAudioFile, TunedAudioFile } from '../types/audio';
import InputSection from '../components/InputSection';
import TuningSection from '../components/TuningSection';
import OutputSection from '../components/OutputSection';
import AccountModal from '../components/AccountModal';
import UploadHistory from '../components/UploadHistory';

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
  userId?: string;
  groupId?: string;
  quota?: {
    usage: number;
    capacity: number;
    period?: string;
  } | null;
}

interface UploadRecord {
  id: string;
  fileName: string;
  displayName: string;
  assetId: string;
  accountName: string;
  uploadedAt: number;
  fileSize?: number;
  duration?: number;
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
  const [showAccountModal, setShowAccountModal] = useState(false);
  
  // Upload history
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);

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

    loadSavedAccounts();
    loadUploadHistory();
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
      const { data, error } = await supabase
        .from('saved_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        const apiKeys = JSON.parse(localStorage.getItem('audioUploader_apiKeys') || '{}');
        
        const accounts: SavedAccount[] = data.map((row: any) => ({
          id: row.id,
          name: row.display_name || row.name,
          type: row.type,
          apiKey: apiKeys[row.id] || '',
          userId: row.owner_id,
          groupId: row.type === 'group' ? row.id : undefined,
          quota: row.audio_usage != null && row.audio_capacity != null ? {
            usage: row.audio_usage,
            capacity: row.audio_capacity,
            period: 'MONTH',
          } : null,
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

  const loadUploadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('audio_uploads')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(50);
      
      if (!error && data) {
        const history: UploadRecord[] = data.map((row: any) => ({
          id: row.id,
          fileName: row.name,
          displayName: row.name,
          assetId: row.asset_id,
          accountName: 'Roblox Account',
          uploadedAt: new Date(row.uploaded_at).getTime(),
        }));
        setUploadHistory(history);
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  };

  const handleAccountAdded = async (account: SavedAccount) => {
    try {
      const { data, error } = await supabase
        .from('saved_accounts')
        .insert({
          id: account.id,
          type: account.type,
          name: account.name,
          display_name: account.name,
          member_count: 0,
          has_verified_badge: false,
          thumbnail: null,
          owner_id: account.userId,
          owner_name: null,
          audio_usage: account.quota?.usage || null,
          audio_capacity: account.quota?.capacity || null,
        })
        .select()
        .single();
      
      if (!error) {
        const apiKeys = JSON.parse(localStorage.getItem('audioUploader_apiKeys') || '{}');
        apiKeys[account.id] = account.apiKey;
        localStorage.setItem('audioUploader_apiKeys', JSON.stringify(apiKeys));
        
        await loadSavedAccounts();
        const newAccount = savedAccounts.find(a => a.id === account.id) || account;
        setSelectedAccount(newAccount);
      }
    } catch (e) {
      console.error('Failed to save account:', e);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      await supabase.from('saved_accounts').delete().eq('id', accountId);
      
      const apiKeys = JSON.parse(localStorage.getItem('audioUploader_apiKeys') || '{}');
      delete apiKeys[accountId];
      localStorage.setItem('audioUploader_apiKeys', JSON.stringify(apiKeys));
      
      await loadSavedAccounts();
    } catch (e) {
      console.error('Failed to delete account:', e);
    }
  };

  const handleUploadSuccess = async (record: UploadRecord) => {
    try {
      await supabase.from('audio_uploads').insert({
        id: record.id,
        asset_id: record.assetId,
        name: record.fileName,
        status: 'Active',
        original_speed: '1',
        amplify: 0,
        roblox_playback_speed: '1',
        account_id: selectedAccount?.id || null,
      });
      
      await loadUploadHistory();
    } catch (e) {
      console.error('Failed to save upload history:', e);
    }
  };

  const handleClearHistory = async () => {
    try {
      await supabase.from('audio_uploads').delete().neq('id', '');
      setUploadHistory([]);
    } catch (e) {
      console.error('Failed to clear history:', e);
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
              <Sun className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTheme('gold')}
              className={`p-3 rounded-lg transition ${theme === 'gold' ? 'bg-yellow-700 text-white' : 'bg-slate-800 text-slate-400'}`}
              title="Gold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Account Selector */}
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl p-5 mb-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-white uppercase tracking-wider">Roblox Account</label>
            <button
              onClick={() => setShowAccountModal(true)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              + Tambah Akun
            </button>
          </div>
          
          {savedAccounts.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700/50">
              <p className="text-slate-400 text-sm mb-3">Belum ada akun tersimpan</p>
              <button
                onClick={() => setShowAccountModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Tambah Akun Pertama
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {savedAccounts.map((account) => (
                <div
                  key={account.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    selectedAccount?.id === account.id
                      ? 'bg-blue-500/10 border-blue-500/50'
                      : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <button
                    onClick={() => setSelectedAccount(account)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <div className={`w-2 h-2 rounded-full ${selectedAccount?.id === account.id ? 'bg-blue-500' : 'bg-slate-600'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{account.name}</p>
                      <p className="text-xs text-slate-500">
                        {account.type === 'group' ? 'Group' : 'User'}
                        {account.quota && (
                          <span className="ml-2">
                            {account.quota.usage}/{account.quota.capacity} audio
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(account.id)}
                    className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                    title="Hapus akun"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* YouTube Cookies */}
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl p-5 mb-6 border border-slate-700/50">
          <label className="text-sm font-semibold text-white uppercase tracking-wider mb-3 block">YouTube Cookies (optional)</label>
          <textarea
            value={youtubeCookies}
            onChange={(e) => setYoutubeCookies(e.target.value)}
            placeholder="Paste Netscape cookies format..."
            className="w-full bg-slate-800/50 text-white px-4 py-3 rounded-xl border border-slate-700/50 focus:border-blue-500/50 focus:outline-none text-sm font-mono resize-none"
            rows={3}
          />
          <p className="text-xs text-slate-500 mt-2">
            Untuk download audio dari YouTube yang memerlukan login
          </p>
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
            onUploadSuccess={handleUploadSuccess}
          />
        </div>

        {/* Upload History */}
        <div className="mt-6">
          <UploadHistory history={uploadHistory} onClear={handleClearHistory} />
        </div>

        {/* Account Modal */}
        <AccountModal
          isOpen={showAccountModal}
          onClose={() => setShowAccountModal(false)}
          onAccountAdded={handleAccountAdded}
          backendUrl={BACKEND_URL}
        />

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
