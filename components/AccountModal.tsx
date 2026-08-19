'use client';

import { useState } from 'react';
import { Loader2, Building2, Check, Sparkles, User, Eye, EyeOff } from 'lucide-react';
import { INPUT, LABEL } from '../lib/ui';
import { SavedAccount } from '../types/audio';
import { Modal } from './ui/Modal';

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
  hasVerifiedBadge?: boolean;
  thumbnail?: string;
}

interface KeyInfoResult {
  success: boolean;
  keyName?: string;
  owner: KeyOwner;
  audioQuota: AudioQuota | null;
  groups: GroupInfo[];
}

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountAdded: (account: SavedAccount) => void;
  backendUrl: string;
}

function QuotaBar({ usage, capacity }: { usage?: number; capacity?: number }) {
  if (usage == null || capacity == null || capacity <= 0) return null;
  const pct = Math.min(100, (usage / capacity) * 100);
  const color = pct >= 90 ? 'bg-rose-400' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400';

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[10px] text-[var(--text-40)] mb-1">
        <span>Audio Quota (bulan ini)</span>
        <span className="font-medium text-[var(--text-60)]">
          {usage.toLocaleString()} / {capacity.toLocaleString()}
        </span>
      </div>
      <div className="w-full h-1.5 bg-[var(--surface-strong)] rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AccountModal({ isOpen, onClose, onAccountAdded, backendUrl }: AccountModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [checking, setChecking] = useState(false);
  const [keyInfo, setKeyInfo] = useState<KeyInfoResult | null>(null);
  const [error, setError] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const [cookie, setCookie] = useState('');

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

    const isGroup = !!selectedGroupId;
    const group = isGroup ? keyInfo.groups.find((g) => g.id === selectedGroupId) : undefined;

    const account: SavedAccount = {
      id: selectedGroupId || keyInfo.owner.id,
      name: isGroup
        ? group?.name || 'Group'
        : keyInfo.owner.displayName || keyInfo.owner.name,
      type: isGroup ? 'group' : 'user',
      apiKey: apiKey.trim(),
      cookie: cookie.trim() || undefined,
      userId: keyInfo.owner.id,
      groupId: selectedGroupId || undefined,
      displayName: keyInfo.owner.displayName || undefined,
      memberCount: group?.memberCount,
      hasVerifiedBadge: isGroup ? (group?.hasVerifiedBadge ?? false) : (keyInfo.owner.hasVerifiedBadge ?? false),
      thumbnail: isGroup ? (group?.thumbnail ?? null) : (keyInfo.owner.thumbnail ?? null),
      ownerName: keyInfo.owner.name,
      quota: keyInfo.audioQuota,
    };

    onAccountAdded(account);
    setApiKey('');
    setCookie('');
    setKeyInfo(null);
    setError('');
    setSelectedGroupId('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tambah Akun Roblox"
      subtitle="API key tersimpan di database, tersinkron untuk semua pengguna."
      size="md"
    >
      <div className="space-y-4">
        {/* API Key Input */}
        <div>
            <label className={LABEL + ' mb-2 block flex items-center justify-between'}>
              <span>API Key</span>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-[11px] text-[var(--accent-soft)] hover:text-[var(--accent-strong)] transition inline-flex items-center gap-1"
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showApiKey ? 'Sembunyikan' : 'Tampilkan'}</span>
              </button>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setKeyInfo(null);
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                placeholder="Paste your Roblox API key here"
                className={INPUT + ' pr-10 font-mono text-xs'}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-40)] hover:text-[var(--text)] transition"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Cookie Input */}
          <div>
            <label className={LABEL + ' mb-2 block flex items-center justify-between'}>
              <span>Roblox Cookie (Opsional - Auto Spoof)</span>
              <span className="text-[10px] text-[var(--accent)]">.ROBLOSECURITY</span>
            </label>
            <input
              type="password"
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              placeholder="_|WARNING:-DO-NOT-SHARE-THIS..."
              className={INPUT}
            />
            <p className="mt-2 text-[11px] text-[var(--text-40)]">
              Memungkinkan otomatisasi spoofing Private Audio tanpa perlu isi manual di Spoofer!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCheck}
              disabled={checking || !apiKey.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent-deep)] py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Mengecek...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Cek API Key
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-[var(--line)] px-6 py-3 text-sm text-[var(--text-60)] transition hover:border-[var(--accent-25)] hover:text-[var(--text)]"
            >
              Batal
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-300">
              {error}
            </div>
          )}

          {/* Key Info */}
          {keyInfo && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-4">
              {/* Owner Info */}
              <div className="flex items-center gap-4">
                {keyInfo.owner.thumbnail ? (
                  <img
                    src={keyInfo.owner.thumbnail}
                    alt={keyInfo.owner.name}
                    className="w-16 h-16 rounded-xl object-cover border border-[var(--line)]"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--text-40)]">
                    <User className="w-8 h-8" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-base font-semibold text-[var(--text)]">
                      {keyInfo.owner.displayName || keyInfo.owner.name}
                    </h4>
                    {keyInfo.owner.hasVerifiedBadge && (
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent-strong)] text-[10px] font-bold text-[var(--on-accent)]">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-[var(--text-45)]">
                    @{keyInfo.owner.name}
                    {keyInfo.keyName && <span className="text-[var(--text-35)]"> · key &quot;{keyInfo.keyName}&quot;</span>}
                  </p>
                </div>
              </div>

              {/* Quota */}
              <QuotaBar usage={keyInfo.audioQuota?.usage} capacity={keyInfo.audioQuota?.capacity} />

              {/* Groups */}
              {keyInfo.groups && keyInfo.groups.length > 0 && (
                <div>
                  <p className="mb-3 text-xs text-[var(--text-40)]">
                    API key milik @{keyInfo.owner.name} — pilih group untuk menyimpan upload:
                  </p>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {keyInfo.groups.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setSelectedGroupId(g.id)}
                        className={`flex w-full items-center gap-3 rounded-lg border p-3 transition-all ${
                          selectedGroupId === g.id
                            ? 'border-[var(--accent-30)] bg-[var(--accent-10)]'
                            : 'border-[var(--line)] bg-[var(--surface-strong)] hover:border-[var(--accent-25)]'
                        }`}
                      >
                        {g.thumbnail ? (
                          <img
                            src={g.thumbnail}
                            alt={g.name}
                            className="h-10 w-10 rounded-lg object-cover border border-[var(--line)]"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--text-40)]">
                            <Building2 className="w-5 h-5" />
                          </div>
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--text-90)]">{g.name}</p>
                          {g.memberCount != null && (
                            <p className="text-xs text-[var(--text-40)]">{g.memberCount.toLocaleString()} members</p>
                          )}
                        </div>
                        {selectedGroupId === g.id && (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-strong)]">
                            <Check className="h-3 w-3 text-[var(--on-accent)]" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={handleSave}
                className="w-full rounded-xl bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent-deep)] py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:brightness-110 active:scale-[0.98]"
              >
                Simpan Akun
              </button>
            </div>
          )}
      </div>
    </Modal>
  );
}
