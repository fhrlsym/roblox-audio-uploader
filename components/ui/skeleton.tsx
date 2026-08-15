'use client';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl bg-gradient-to-r from-[var(--surface-strong)] via-[var(--surface-focus)] to-[var(--surface-strong)] bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}