'use client';

import { CheckCircle2, Clock, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  Active:    { icon: CheckCircle2, className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',    label: 'Active' },
  Success:   { icon: CheckCircle2, className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',    label: 'Success' },
  Pending:   { icon: Clock,        className: 'border-[var(--accent-30)] bg-[var(--accent-10)] text-[var(--accent-strong)]', label: 'Pending' },
  Copyright: { icon: ShieldAlert,  className: 'border-rose-400/25 bg-rose-400/10 text-rose-300',              label: 'Copyright' },
  Failed:    { icon: XCircle,      className: 'border-[var(--line)] bg-[var(--surface-soft)] text-[var(--text-50)]', label: 'Failed' },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium border ${config.className}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

export function RefreshBadge({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium border border-[var(--line)] bg-[var(--surface)] text-[var(--text-50)] hover:text-[var(--text)] transition disabled:opacity-40"
    >
      <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
      Refresh
    </button>
  );
}