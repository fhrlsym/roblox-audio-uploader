'use client';

import { useState } from 'react';
import { RawAudioFile } from '../types/audio';

interface InputSectionProps {
  onFilesAdded: (files: RawAudioFile[]) => void;
  backendUrl: string;
  youtubeCookies: string;
}

export default function InputSection({ onFilesAdded, backendUrl, youtubeCookies }: InputSectionProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'youtube'>('file');
  const [youtubeUrls, setYoutubeUrls] = useState<string>('');
  const [converting, setConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState<{ url: string; status: string; error?: string }[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const rawFiles: RawAudioFile[] = Array.from(files).map((file) => ({
      id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: file.name,
      file,
      size: file.size,
    }));

    onFilesAdded(rawFiles);
  };

  const handleYoutubeConvert = async () => {
    const urls = youtubeUrls
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u);

    if (urls.length === 0) return;

    setConverting(true);
    setConvertProgress(urls.map((url) => ({ url, status: 'converting' })));

    const results: RawAudioFile[] = [];

    for (const url of urls) {
      try {
        const response = await fetch(`${backendUrl}/api/youtube-download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, speed: 1.0, amplify: 0, cookies: youtubeCookies }),
        });

        const data = await response.json();

        if (data.success) {
          results.push({
            id: `yt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            name: data.filename,
            fileId: data.fileId,
            url,
            video: data.filename,
          });

          setConvertProgress((prev) =>
            prev.map((p) => (p.url === url ? { ...p, status: 'completed' } : p))
          );
        } else {
          throw new Error(data.error || 'Download failed');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Download failed';
        setConvertProgress((prev) =>
          prev.map((p) => (p.url === url ? { ...p, status: 'failed', error: message } : p))
        );
      }
    }

    if (results.length > 0) {
      onFilesAdded(results);
    }

    setConverting(false);
    setTimeout(() => setConvertProgress([]), 3000);
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">1. Input Audio</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('file')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'file'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Upload File
        </button>
        <button
          onClick={() => setActiveTab('youtube')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'youtube'
              ? 'bg-red-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          From YouTube
        </button>
      </div>

      {/* File Upload Tab */}
      {activeTab === 'file' && (
        <div>
          <label className="block w-full border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition">
            <div className="text-slate-400 mb-2">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-lg font-medium">Click to upload or drag and drop</p>
              <p className="text-sm">MP3, WAV, OGG, M4A (multiple files supported)</p>
            </div>
            <input
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      )}

      {/* YouTube Tab */}
      {activeTab === 'youtube' && (
        <div>
          <textarea
            value={youtubeUrls}
            onChange={(e) => setYoutubeUrls(e.target.value)}
            placeholder="Paste YouTube URLs (one per line)..."
            className="w-full h-32 bg-slate-800 text-white rounded-lg p-3 border border-slate-600 focus:border-red-500 focus:outline-none"
          />
          <button
            onClick={handleYoutubeConvert}
            disabled={converting || !youtubeUrls.trim()}
            className="mt-3 w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition"
          >
            {converting ? 'Converting...' : 'Convert to MP3'}
          </button>

          {/* Progress */}
          {convertProgress.length > 0 && (
            <div className="mt-4 space-y-2">
              {convertProgress.map((p, i) => (
                <div key={i} className="bg-slate-800 rounded p-2 text-sm">
                  <p className="text-slate-400 truncate">{p.url}</p>
                  <p className={`font-medium ${
                    p.status === 'completed' ? 'text-green-400' :
                    p.status === 'failed' ? 'text-red-400' :
                    'text-yellow-400'
                  }`}>
                    {p.status === 'completed' ? '✓ Completed' :
                     p.status === 'failed' ? `✕ ${p.error}` :
                     '⏳ Converting...'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
