'use client';

import { useState } from 'react';
import { TunedAudioFile, UploadResult } from '../types/audio';

interface OutputSectionProps {
  tunedFiles: TunedAudioFile[];
  onRemoveTuned: (id: string) => void;
  backendUrl: string;
  selectedAccount: any;
}

export default function OutputSection({ tunedFiles, onRemoveTuned, backendUrl, selectedAccount }: OutputSectionProps) {
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
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">3. Output</h2>

      {tunedFiles.length === 0 ? (
        <p className="text-slate-500 text-center py-8">No tuned files yet. Tune your raw files first.</p>
      ) : (
        <div className="space-y-3">
          {tunedFiles.map((file) => {
            const result = uploadResults[file.id];
            const isUploading = uploading[file.id];

            return (
              <div key={file.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{file.tunedName}</p>
                    <p className="text-slate-400 text-sm">
                      Speed: {file.speed}x · Amplify: {file.amplify > 0 ? '+' : ''}{file.amplify}dB · 
                      Roblox: {(1 / file.speed).toFixed(4)}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveTuned(file.id)}
                    className="ml-3 text-red-400 hover:text-red-300 transition"
                  >
                    ✕
                  </button>
                </div>

                {/* Result */}
                {result && (
                  <div className={`mb-3 p-3 rounded-lg ${
                    result.success ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'
                  }`}>
                    {result.success ? (
                      <div>
                        <p className="text-green-400 font-semibold">✓ Uploaded Successfully</p>
                        <p className="text-slate-300 text-sm">Asset ID: {result.assetId}</p>
                        <p className="text-slate-400 text-sm">Status: {result.status}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-red-400 font-semibold">✕ Upload Failed</p>
                        <p className="text-slate-300 text-sm">{result.error}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(file)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
                  >
                    📥 Download MP3
                  </button>
                  <button
                    onClick={() => handleUploadToRoblox(file)}
                    disabled={isUploading || !!result}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition"
                  >
                    {isUploading ? '⏳ Uploading...' : result ? '✓ Uploaded' : '🚀 Upload to Roblox'}
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
