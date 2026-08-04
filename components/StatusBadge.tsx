import { CheckCircle2, Clock, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';

const STATUS_CONFIG: Record<string, { icon: typeof Clock; className: string; label: string }> = {
  Active: {
    icon: CheckCircle2,
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    label: 'Active',
  },
  Success: {
    icon: CheckCircle2,
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    label: 'Success',
  },
  Pending: {
    icon: Clock,
    className: 'border-[var(--accent-30)] bg-[var(--accent-10)] text-[var(--accent-strong)]',
    label: 'Pending',
  },
  Copyright: {
    icon: ShieldAlert,
    className: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
    label: 'Copyright',
  },
  Failed: {
    icon: XCircle,
    className: 'border-[var(--line)] bg-[var(--surface-soft)] text-[var(--text-50)]',
    label: 'Failed',
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.Failed;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${config.className}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export function RefreshBadge({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-25)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-soft)] transition hover:bg-[var(--accent-10)] hover:text-[var(--accent-strong)] disabled:opacity-50"
    >
      <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
      Refresh
    </button>
  );
}
