'use client';

import { useState } from 'react';

interface KeyOwner {
  id: string;
  name: string;
  displayName?: string;
  hasVerifiedBadge?: boolean;
  thumbnail?: string;
}

interface AudioQuota {
  usage: number;
  capacity: number;
  period?: string;
}

interface GroupInfo {
  id: string;
  name: string;
  memberCount?: number;
  thumbnail?: string;
}

interface KeyInfoResult {
  success: boolean;
  keyName?: string;
  owner: KeyOwner;
  audioQuota: AudioQuota | null;
  groups: GroupInfo[];
}

interface AddedAccount {
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

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountAdded: (account: AddedAccount) => void;
  backendUrl: string;
}

function QuotaBar({ usage, capacity }: { usage?: number; capacity?: number }) {
  if (usage == null || capacity == null || capacity <= 0) return null;
  const pct = Math.min(100, (usage / capacity) * 100);
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
        <span>Audio Quota (bulan ini)</span>
        <span className="font-medium text-slate-300">
          {usage.toLocaleString()} / {capacity.toLocaleString()}
        </span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AccountModal({ isOpen, onClose, onAccountAdded, backendUrl }: AccountModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [checking, setChecking] = useState(false);
  const [keyInfo, setKeyInfo] = useState<KeyInfoResult | null>(null);
  const [error, setError] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  if (!isOpen) return null;

  const handleCheck = async () => {
    if (!apiKey.trim()) {
      setError('Masukkan API key terlebih dahulu');
      return;
    }

    setChecking(true);
    setKeyInfo(null);
    setError('');

    try {
      const response = await fetch(
        `${backendUrl}/api/roblox/key-info?apiKey=${encodeURIComponent(apiKey)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memeriksa API key');
      }

      setKeyInfo(data);
      if (data.groups && data.groups.length > 0) {
        setSelectedGroupId(data.groups[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memeriksa API key';
      setError(message);
    } finally {
      setChecking(false);
    }
  };

  const handleSave = () => {
    if (!keyInfo) return;

    const account: AddedAccount = {
      id: selectedGroupId || keyInfo.owner.id,
      name: selectedGroupId
        ? keyInfo.groups.find((g) => g.id === selectedGroupId)?.name || 'Group'
        : keyInfo.owner.displayName || keyInfo.owner.name,
      type: selectedGroupId ? 'group' : 'user',
      apiKey: apiKey.trim(),
      userId: keyInfo.owner.id,
      groupId: selectedGroupId || undefined,
      quota: keyInfo.audioQuota,
    };

    onAccountAdded(account);
    setApiKey('');
    setKeyInfo(null);
    setError('');
    setSelectedGroupId('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <h3 className="text-xl font-bold text-white">Tambah Akun Roblox</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* API Key Input */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setKeyInfo(null);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
              placeholder="Paste your Roblox API key here"
              className="w-full bg-slate-800/50 text-white rounded-xl px-4 py-3 border border-slate-700/50 focus:border-blue-500/50 focus:outline-none transition-colors"
            />
            <p className="mt-2 text-[11px] text-slate-500">
              Pemilik akun & group akan otomatis terdeteksi, kuota audio langsung terlihat.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCheck}
              disabled={checking || !apiKey.trim()}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-800 disabled:to-slate-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
            >
              {checking ? 'Mengecek...' : 'Cek API Key'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
            >
              Batal
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Key Info */}
          {keyInfo && (
            <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-4 space-y-4">
              {/* Owner Info */}
              <div className="flex items-center gap-4">
                {keyInfo.owner.thumbnail ? (
                  <img
                    src={keyInfo.owner.thumbnail}
                    alt={keyInfo.owner.name}
                    className="w-16 h-16 rounded-xl object-cover border border-slate-700/50"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-700/50 flex items-center justify-center text-2xl text-slate-500">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-semibold text-white truncate">
                      {keyInfo.owner.displayName || keyInfo.owner.name}
                    </h4>
                    {keyInfo.owner.hasVerifiedBadge && (
                      <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 truncate">
                    @{keyInfo.owner.name}
                    {keyInfo.keyName && <span className="text-slate-500"> · key &quot;{keyInfo.keyName}&quot;</span>}
                  </p>
                </div>
              </div>

              {/* Quota */}
              <QuotaBar usage={keyInfo.audioQuota?.usage} capacity={keyInfo.audioQuota?.capacity} />

              {/* Groups */}
              {keyInfo.groups && keyInfo.groups.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-3">
                    API key milik @{keyInfo.owner.name} — pilih group untuk menyimpan upload:
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {keyInfo.groups.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setSelectedGroupId(g.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          selectedGroupId === g.id
                            ? 'border-blue-500/50 bg-blue-500/10'
                            : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
                        }`}
                      >
                        {g.thumbnail ? (
                          <img
                            src={g.thumbnail}
                            alt={g.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-700/50"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-500">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-medium text-white truncate">{g.name}</p>
                          {g.memberCount != null && (
                            <p className="text-xs text-slate-500">{g.memberCount.toLocaleString()} members</p>
                          )}
                        </div>
                        {selectedGroupId === g.id && (
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={handleSave}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
              >
                Simpan Akun
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
