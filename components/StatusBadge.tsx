import { CheckCircle2, Clock, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';

const STATUS_CONFIG: Record<string, { icon: typeof Clock; className: string; label: string }> = {
  Active: {
    icon: CheckCircle2,
    className: 'bg-[var(--emerald)] text-white',
    label: 'Active',
  },
  Success: {
    icon: CheckCircle2,
    className: 'bg-[var(--emerald)] text-white',
    label: 'Success',
  },
  Pending: {
    icon: Clock,
    className: 'bg-[var(--accent)] text-[var(--on-accent)]',
    label: 'Pending',
  },
  Copyright: {
    icon: ShieldAlert,
    className: 'bg-[var(--danger)] text-white',
    label: 'Copyright',
  },
  Failed: {
    icon: XCircle,
    className: 'bg-[var(--bg)] text-[var(--text)]',
    label: 'Failed',
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.Failed;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--text)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${config.className}`}
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
      className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--text)] bg-[var(--panel)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text)] shadow-[2px_2px_0_0_var(--text)] transition hover:-translate-y-[1px] hover:shadow-[3px_3px_0_0_var(--text)] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--text)] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0_0_var(--text)]"
    >
      <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
      Refresh
    </button>
  );
}
