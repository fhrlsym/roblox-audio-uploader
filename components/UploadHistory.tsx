'use client';

interface UploadRecord {
  id: string;
  fileName: string;
  displayName: string;
  assetId: string;
  accountName: string;
  uploadedAt: number;
  fileSize?: number;
  duration?: number;
}

interface UploadHistoryProps {
  history: UploadRecord[];
  onClear: () => void;
}

export default function UploadHistory({ history, onClear }: UploadHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 text-center">
        <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-slate-500 text-sm">Belum ada riwayat upload</p>
      </div>
    );
  }

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return `${minutes} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days < 7) return `${days} hari lalu`;
    
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const copyAssetId = (assetId: string) => {
    navigator.clipboard.writeText(`rbxassetid://${assetId}`);
  };

  return (
    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div>
          <h3 className="text-base font-semibold text-white">Riwayat Upload</h3>
          <p className="text-xs text-slate-500 mt-0.5">{history.length} audio berhasil diupload</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-slate-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
          >
            Hapus Semua
          </button>
        )}
      </div>

      {/* List */}
      <div className="divide-y divide-slate-700/30 max-h-96 overflow-y-auto">
        {history.map((record) => (
          <div
            key={record.id}
            className="p-4 hover:bg-slate-700/20 transition-colors group"
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 border border-slate-700/50">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-white truncate">{record.displayName}</h4>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{record.fileName}</p>
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0">{formatDate(record.uploadedAt)}</span>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span>{record.accountName}</span>
                  {record.fileSize && <span>{formatBytes(record.fileSize)}</span>}
                  {record.duration && <span>{formatDuration(record.duration)}</span>}
                </div>

                {/* Asset ID */}
                <button
                  onClick={() => copyAssetId(record.assetId)}
                  className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-lg transition-colors group/btn"
                >
                  <code className="text-xs text-blue-400 font-mono">rbxassetid://{record.assetId}</code>
                  <svg className="w-3.5 h-3.5 text-slate-500 group-hover/btn:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
