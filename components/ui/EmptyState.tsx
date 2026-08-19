import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}

export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line)] py-8 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-50)] text-[var(--text-35)]">
        {icon}
      </div>
      <p className="text-sm font-semibold text-[var(--text-70)]">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--text-40)]">{description}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
