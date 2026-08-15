'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Plus, X, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { StatusBadge } from '../../../components/shared/status-badge';
import { RobloxService } from '../../../lib/services/roblox.service';
import { useAccountStore } from '../../../lib/stores/accountStore';
import { useUIStore } from '../../../lib/stores/uiStore';
import { useSpoofHistory, useUpsertSpoof, useClearSpoofHistory } from '../../../lib/queries/useSpoofHistory';

export default function SpooferPage() {
  const [assetId, setAssetId] = useState('');
  const [queue, setQueue] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{ assetId: string; name?: string; newAssetId?: string; success?: boolean; error?: string }[]>([]);
  const addToast = useUIStore((s) => s.addToast);
  const accounts = useAccountStore((s) => s.accounts);
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const { data: history } = useSpoofHistory();
  const upsertSpoof = useUpsertSpoof();
  const clearHistory = useClearSpoofHistory();

  const addToQueue = () => {
    const id = assetId.trim();
    if (!id) return;
    if (queue.includes(id)) { addToast('Already in queue', 'info'); return; }
    setQueue([...queue, id]);
    setAssetId('');
  };

  const removeFromQueue = (id: string) => setQueue(queue.filter((q) => q !== id));

  const handleSpoof = async () => {
    if (queue.length === 0) return;
    setProcessing(true);
    setResults([]);

    try {
      const items = await RobloxService.spoofDirect(
        queue,
        selectedAccount ? {
          creatorType: selectedAccount.type === 'group' ? 'Group' : 'User',
          creatorId: selectedAccount.id,
          apiKey: selectedAccount.apiKey,
        } : undefined
      );

      setResults(items);
      for (const item of items) {
        await upsertSpoof.mutateAsync({
          assetId: item.assetId,
          name: item.name,
          assetType: item.assetType,
          newAssetId: item.newAssetId,
          success: item.success || false,
        });
      }
      const successCount = items.filter((i) => i.success).length;
      addToast(`${successCount}/${items.length} assets processed`, successCount > 0 ? 'success' : 'error');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Spoof failed', 'error');
    }
    setProcessing(false);
    setQueue([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-[var(--text)]">Asset Spoofer</h1>
        <p className="text-xs text-[var(--text-50)]">Clone Roblox assets to your account</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  placeholder="Enter Roblox Asset ID..."
                  onKeyDown={(e) => e.key === 'Enter' && addToQueue()}
                />
              </div>
              <Button variant="secondary" onClick={addToQueue} disabled={!assetId.trim()}>
                <Plus size={16} />
                Add
              </Button>
            </div>

            {queue.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-45)]">
                    Queue ({queue.length})
                  </span>
                  <Button size="sm" onClick={handleSpoof} loading={processing}>
                    <Copy size={14} />
                    Spoof {queue.length > 1 ? `All (${queue.length})` : ''}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {queue.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-strong)] text-xs font-mono text-[var(--text)]">
                      {id}
                      <button onClick={() => removeFromQueue(id)} className="text-[var(--text-40)] hover:text-[var(--text)]">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-45)]">Results</h3>
                {results.map((r) => (
                  <div key={r.assetId} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-soft)]">
                    {r.success ? (
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle size={16} className="text-rose-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[var(--text)] truncate">{r.name || `Asset ${r.assetId}`}</div>
                      <div className="text-[10px] text-[var(--text-40)] font-mono">
                        {r.assetId} {r.newAssetId ? `→ ${r.newAssetId}` : ''}
                      </div>
                    </div>
                    {r.newAssetId && (
                      <button
                        onClick={() => navigator.clipboard.writeText(r.newAssetId!)}
                        className="p-1.5 rounded-lg hover:bg-[var(--surface-strong)] text-[var(--text-40)]"
                      >
                        <Copy size={14} />
                      </button>
                    )}
                    {r.success && (
                      <StatusBadge status="Success" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-60)]">History</h2>
          {history && history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => clearHistory.mutateAsync()}>
              <Trash2 size={14} />
              Clear
            </Button>
          )}
        </div>
        <Card>
          <CardContent className="p-4">
            {!history || history.length === 0 ? (
              <p className="text-xs text-[var(--text-40)] text-center py-4">No spoof history yet</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {history.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface)] transition text-xs">
                    {item.success ? (
                      <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle size={12} className="text-rose-400 shrink-0" />
                    )}
                    <span className="text-[var(--text-60)] font-mono flex-1 truncate">{item.assetId}</span>
                    {item.newAssetId && (
                      <span className="text-[var(--text-35)] font-mono truncate max-w-[80px]">→ {item.newAssetId.slice(0, 8)}...</span>
                    )}
                    {item.name && <span className="text-[var(--text-50)] truncate max-w-[100px]">{item.name}</span>}
                    <button
                      onClick={() => navigator.clipboard.writeText(item.newAssetId || item.assetId)}
                      className="p-1 rounded hover:bg-[var(--surface-strong)] text-[var(--text-35)]"
                    >
                      <Copy size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}