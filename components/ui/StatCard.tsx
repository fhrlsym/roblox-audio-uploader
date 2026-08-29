import type { ReactNode } from 'react';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  tone?: 'default' | 'accent' | 'success' | 'danger';
  topBar?: boolean;
}

const TONES = {
  default: 'text-[var(--text)]',
  accent: 'text-[var(--accent-strong)]',
  success: 'text-[var(--emerald)]',
  danger: 'text-[var(--danger)]',
};

const TOPBAR = {
  default: 'bg-[var(--accent)]',
  accent: 'bg-[var(--accent)]',
  success: 'bg-[var(--emerald)]',
  danger: 'bg-[var(--danger)]',
};

const ICON = {
  default: 'text-[var(--accent)]',
  accent: 'text-[var(--accent)]',
  success: 'text-[var(--emerald)]',
  danger: 'text-[var(--danger)]',
};

export function StatCard({ label, icon, value, tone = 'default', topBar = false }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden p-3 text-center sm:p-4">
      {topBar && (
        <span className={`absolute inset-x-0 top-0 h-1 ${TOPBAR[tone]}`} />
      )}
      <p className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide sm:text-[11px] ${ICON[tone]}`}>
        {icon}
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold sm:text-2xl ${TONES[tone]}`}>{value}</p>
    </Card>
  );
}
