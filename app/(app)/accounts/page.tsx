'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserCircle2, Plus, Trash2, Key, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { useAccountStore, type SavedAccount } from '../../../lib/stores/accountStore';
import { useUIStore } from '../../../lib/stores/uiStore';
import { RobloxService } from '../../../lib/services/roblox.service';

export default function AccountsPage() {
  const accounts = useAccountStore((s) => s.accounts);
  const addAccount = useAccountStore((s) => s.addAccount);
  const removeAccount = useAccountStore((s) => s.removeAccount);
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const selectAccount = useAccountStore((s) => s.selectAccount);
  const updateQuota = useAccountStore((s) => s.updateQuota);
  const addToast = useUIStore((s) => s.addToast);

  const [modalOpen, setModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    keyName: string;
    owner: { id: string; type: string; name: string; displayName: string };
    groups: { id: string; name: string; memberCount: number; hasVerifiedBadge: boolean; thumbnail: string }[];
  } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const handleValidate = async () => {
    if (!apiKey.trim()) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const info = await RobloxService.getKeyInfo(apiKey.trim());
      setValidationResult(info);
      if (info.groups.length === 0) {
        setSelectedGroup(null);
      } else if (info.groups.length === 1) {
        setSelectedGroup(info.groups[0].id);
      }
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Invalid API key', 'error');
    }
    setValidating(false);
  };

  const handleSave = async () => {
    if (!validationResult) return;
    const isGroup = selectedGroup !== null;
    const group = isGroup ? validationResult.groups.find((g) => g.id === selectedGroup) : null;
    const owner = validationResult.owner;

    const account: SavedAccount = {
      id: isGroup && group ? group.id : owner.id,
      type: isGroup ? 'group' : 'user',
      name: isGroup && group ? group.name : owner.name,
      displayName: isGroup && group ? group.name : owner.displayName || owner.name,
      thumbnail: isGroup && group ? group.thumbnail || null : null,
      apiKey: apiKey.trim(),
      userId: owner.id,
      groupId: isGroup && group ? group.id : undefined,
    };

    try {
      const quota = await RobloxService.getQuota(
        apiKey.trim(),
        isGroup ? selectedGroup! : validationResult.owner.id,
        isGroup ? 'Group' : 'User'
      );
      account.audioUsage = quota.usage;
      account.audioCapacity = quota.capacity;
    } catch {}

    await addAccount(account);
    selectAccount(account.id);
    addToast(`Account "${account.displayName}" added`, 'success');
    setModalOpen(false);
    setApiKey('');
    setValidationResult(null);
    setSelectedGroup(null);
  };

  const handleRefreshQuota = async (account: SavedAccount) => {
    try {
      const isGroup = account.type === 'group';
      const id = isGroup ? (account.groupId || account.id) : (account.userId || account.id);
      const quota = await RobloxService.getQuota(account.apiKey, id, isGroup ? 'Group' : 'User');
      updateQuota(account.id, quota.usage, quota.capacity);
      addToast('Quota refreshed', 'success');
    } catch {
      addToast('Failed to refresh quota', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">Accounts</h1>
          <p className="text-xs text-[var(--text-50)]">Manage your Roblox API keys</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} />
          Add Account
        </Button>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {accounts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <UserCircle2 size={40} className="mx-auto mb-4 text-[var(--text-25)]" />
              <p className="text-sm text-[var(--text-50)]">No accounts yet</p>
              <p className="text-xs text-[var(--text-35)] mt-1">Add a Roblox API key to start uploading</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => setModalOpen(true)}>
                <Plus size={14} />
                Add Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((account) => {
              const pct = account.audioCapacity ? ((account.audioUsage || 0) / account.audioCapacity) * 100 : 0;
              const quotaColor = pct >= 90 ? 'bg-rose-400' : pct >= 70 ? 'bg-amber-400' : 'bg-[var(--accent)]';
              const isSelected = selectedAccountId === account.id;

              return (
                <Card key={account.id} hover className={isSelected ? 'ring-1 ring-[var(--accent-40)]' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {account.thumbnail ? (
                        <img src={account.thumbnail} alt="" className="w-10 h-10 rounded-xl object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-20)] to-[var(--accent-10)] flex items-center justify-center">
                          <UserCircle2 size={20} className="text-[var(--accent-strong)]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-[var(--text)] truncate">{account.displayName || account.name}</h3>
                          {isSelected && <CheckCircle2 size={14} className="text-[var(--accent-strong)] shrink-0" />}
                        </div>
                        <p className="text-[10px] text-[var(--text-45)] capitalize">{account.type}</p>
                      </div>
                      <button
                        onClick={() => removeAccount(account.id)}
                        className="p-1 rounded hover:bg-[var(--surface-strong)] text-[var(--text-35)]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-[var(--text-45)]">Audio Quota</span>
                        <span className="text-[var(--text-60)]">
                          {account.audioUsage ?? '?'} / {account.audioCapacity ?? '?'}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--surface-strong)] overflow-hidden">
                        <div className={`h-full rounded-full ${quotaColor} transition-[width] duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => { selectAccount(account.id); addToast(`Using ${account.displayName || account.name}`, 'success'); }}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRefreshQuota(account)}>
                        <Key size={12} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setValidationResult(null); }} title="Add Account">
        <div className="space-y-4">
          <div>
            <Input
              label="Roblox API Key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your Open Cloud API key..."
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="mt-1 text-[10px] text-[var(--accent-strong)] hover:underline flex items-center gap-1"
            >
              {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
              {showKey ? 'Hide' : 'Show'} key
            </button>
          </div>

          <Button onClick={handleValidate} loading={validating} disabled={!apiKey.trim()} className="w-full">
            <Key size={14} />
            Validate & Fetch Info
          </Button>

          {validationResult && (
            <div className="space-y-4">
              <div className="rounded-xl bg-[var(--surface-soft)] p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center">
                    <CheckCircle2 size={16} className="text-[var(--on-accent)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">{validationResult.owner.displayName}</p>
                    <p className="text-[10px] text-[var(--text-45)]">Key: {validationResult.keyName}</p>
                  </div>
                </div>
              </div>

              {validationResult.groups.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-45)] block mb-2">
                    Select Group (optional)
                  </label>
                  <div className="space-y-1">
                    {validationResult.groups.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => setSelectedGroup(selectedGroup === group.id ? null : group.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                          selectedGroup === group.id
                            ? 'bg-[var(--accent-10)] border border-[var(--accent-25)]'
                            : 'hover:bg-[var(--surface)] border border-transparent'
                        }`}
                      >
                        {group.thumbnail ? (
                          <img src={group.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-[var(--surface-strong)]" />
                        )}
                        <div className="text-left flex-1">
                          <div className="text-xs font-medium text-[var(--text)]">{group.name}</div>
                          <div className="text-[10px] text-[var(--text-45)]">{group.memberCount} members</div>
                        </div>
                        {selectedGroup === group.id && <CheckCircle2 size={16} className="text-[var(--accent-strong)]" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={handleSave} className="w-full">
                <Plus size={14} />
                Save Account
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}