'use client';

import { useState } from 'react';
import { TunedAudioFile, UploadResult } from '../types/audio';

interface OutputSectionProps {
  tunedFiles: TunedAudioFile[];
  onRemoveTuned: (id: string) => void;
  backendUrl: string;
  selectedAccount: any;
  onUploadSuccess?: (record: {
    id: string;
    fileName: string;
    displayName: string;
    assetId: string;
    accountName: string;
    uploadedAt: number;
    fileSize?: number;
    duration?: number;
  }) => void;
}

export default function OutputSection({ tunedFiles, onRemoveTuned, backendUrl, selectedAccount, onUploadSuccess }: OutputSectionProps) {
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadResults, setUploadResults] = useState<Record<string, UploadResult>>({});

  const handleDownload = (file: TunedAudioFile) => {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.tunedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUploadToRoblox = async (file: TunedAudioFile) => {
    if (!selectedAccount || !selectedAccount.apiKey) {
      alert('Please select a Roblox account first');
      return;
    }

    setUploading((prev) => ({ ...prev, [file.id]: true }));

    try {
      // Upload file to backend
      const formData = new FormData();
      formData.append('file', file.blob, file.tunedName);
      formData.append('displayName', file.tunedName);
      formData.append('description', `Speed: ${file.speed}x | Amplify: ${file.amplify}dB | Roblox Playback: ${(1 / file.speed).toFixed(4)}`);
      formData.append('creatorType', selectedAccount.type);
      formData.append('creatorId', selectedAccount.id);
      formData.append('apiKey', selectedAccount.apiKey);

      const response = await fetch(`${backendUrl}/api/upload-to-roblox`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.operationId) {
        // Poll for moderation result
        let assetId: string | null = null;
        let status = 'Pending';
        let opError: string | null = null;

        for (let attempt = 0; attempt < 120; attempt++) {
          await new Promise((r) => setTimeout(r, 3000));

          const opResponse = await fetch(
            `${backendUrl}/api/operation-status/${data.operationId}?apiKey=${encodeURIComponent(selectedAccount.apiKey)}`
          );
          const opData = await opResponse.json();

          if (opData.done) {
            if (opData.assetId) {
              assetId = opData.assetId;
              status = opData.status || 'Pending';
            } else {
              opError = opData.error || 'Upload failed during moderation';
            }
            break;
          }
        }

        if (assetId) {
          setUploadResults((prev) => ({
            ...prev,
            [file.id]: { filename: file.tunedName, assetId, status, success: true },
          }));
          
          // Add to history
          if (onUploadSuccess) {
            onUploadSuccess({
              id: `${Date.now()}-${file.id}`,
              fileName: file.tunedName,
              displayName: file.tunedName,
              assetId,
              accountName: selectedAccount.name,
              uploadedAt: Date.now(),
              fileSize: file.blob.size,
            });
          }
        } else {
          setUploadResults((prev) => ({
            ...prev,
            [file.id]: { filename: file.tunedName, error: opError || 'Upload timeout', success: false },
          }));
        }
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setUploadResults((prev) => ({
        ...prev,
        [file.id]: { filename: file.tunedName, error: message, success: false },
      }));
    } finally {
      setUploading((prev) => ({ ...prev, [file.id]: false }));
    }
  };

  return (
    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
      <h2 className="text-xl font-bold text-white mb-4">3. Output & Upload</h2>

      {tunedFiles.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-slate-500 text-sm">Belum ada file yang di-tune</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tunedFiles.map((file) => {
            const result = uploadResults[file.id];
            const isUploading = uploading[file.id];

            return (
              <div key={file.id} className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate text-sm">{file.tunedName}</p>
                    <p className="text-slate-400 text-xs mt-1">
                      Speed: {file.speed}x · Amplify: {file.amplify > 0 ? '+' : ''}{file.amplify}dB · 
                      Roblox: {(1 / file.speed).toFixed(4)}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveTuned(file.id)}
                    className="ml-3 text-slate-500 hover:text-red-400 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {result && (
                  <div className={`mb-3 p-3 rounded-lg border ${
                    result.success 
                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    {result.success ? (
                      <div>
                        <p className="text-emerald-400 font-semibold text-sm flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Upload Berhasil
                        </p>
                        <p className="text-slate-300 text-xs mt-1">Asset ID: {result.assetId}</p>
                        <p className="text-slate-400 text-xs">Status: {result.status}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-red-400 font-semibold text-sm flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Upload Gagal
                        </p>
                        <p className="text-slate-300 text-xs mt-1">{result.error}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(file)}
                    className="flex-1 bg-blue-600/90 hover:bg-blue-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
                  >
                    Download MP3
                  </button>
                  <button
                    onClick={() => handleUploadToRoblox(file)}
                    disabled={isUploading || !!result}
                    className="flex-1 bg-emerald-600/90 hover:bg-emerald-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
                  >
                    {isUploading ? 'Uploading...' : result ? 'Uploaded' : 'Upload to Roblox'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
