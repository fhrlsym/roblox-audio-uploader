import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}

export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="brutal-card-sm py-8 text-center">
      <div className="brutal-icon-box mx-auto mb-3 bg-[var(--bg)] text-[var(--text-50)]">
        {icon}
      </div>
      <p className="text-sm font-bold uppercase tracking-wide text-[var(--text-80)]">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-xs font-medium text-[var(--text-50)]">{description}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
