'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="max-w-md w-full rounded-2xl border border-rose-400/20 bg-[var(--panel)] p-8 text-center space-y-4 shadow-2xl">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-400/10 flex items-center justify-center">
          <svg className="w-7 h-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Terjadi Kesalahan</h2>
          <p className="mt-2 text-sm text-[var(--text-50)]">
            Something went wrong. Coba muat ulang halaman.
          </p>
        </div>
        {error.message && (
          <pre className="text-[11px] text-rose-300 bg-rose-400/5 rounded-xl p-3 overflow-auto max-h-24 text-left font-mono">
            {error.message}
          </pre>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent-deep)] px-6 py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:brightness-110 active:scale-[0.97]"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
