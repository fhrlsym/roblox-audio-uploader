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
      <div className="brutal-card max-w-md w-full p-8 text-center space-y-4">
        <div className="brutal-icon-box mx-auto h-14 w-14 bg-[var(--danger)] text-white">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-extrabold uppercase tracking-wide text-[var(--text)]">Terjadi Kesalahan</h2>
          <p className="mt-2 text-sm font-medium text-[var(--text-50)]">
            Something went wrong. Coba muat ulang halaman.
          </p>
        </div>
        {error.message && (
          <pre className="text-[11px] font-mono text-white bg-black border-2 border-[var(--text)] rounded-lg p-3 overflow-auto max-h-24 text-left">
            {error.message}
          </pre>
        )}
        <button
          onClick={reset}
          className="brutal-btn-primary w-full justify-center py-3"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
