'use client';

import { useState } from 'react';

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [targetType, setTargetType] = useState<'user' | 'group'>('user');
  const [userId, setUserId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [apiKey, setApiKey] = useState('');

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
      ['audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/wav', 'audio/mp3'].includes(file.type) ||
      file.name.match(/\.(mp3|ogg|flac|wav)$/i)
    );
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (!apiKey || (!userId && !groupId)) {
      alert('Mohon isi API Key dan User ID / Group ID terlebih dahulu');
      return;
    }

    setUploading(true);
    setResults([]);

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('apiKey', apiKey);
        formData.append('targetType', targetType);
        formData.append('targetId', targetType === 'user' ? userId : groupId);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        setResults(prev => [...prev, { name: file.name, ...data }]);
      } catch (error) {
        setResults(prev => [...prev, { name: file.name, error: 'Upload gagal', success: false }]);
      }
    }

    setUploading(false);
  };

  const copyResults = () => {
    const successResults = results.filter(r => r.success);
    const text = successResults.map(r => `${r.name}: ${r.assetId}`).join('\n');
    navigator.clipboard.writeText(text);
    alert('Hasil berhasil disalin!');
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 border-b border-[#2a2a4a] pb-6">
          <h1 className="text-2xl font-bold text-[#ff8c00] mb-2">🎵 Roblox Audio Uploader</h1>
          <p className="text-sm text-gray-400">Upload audio ke Roblox via Open Cloud API</p>
          <div className="flex justify-center gap-2 mt-3">
            <span className="text-xs px-3 py-1 rounded-full border border-[#ff8c00] text-[#ff8c00]">MP3</span>
            <span className="text-xs px-3 py-1 rounded-full border border-[#ffcc00] text-[#ffcc00]">OGG</span>
            <span className="text-xs px-3 py-1 rounded-full border border-[#00d4ff] text-[#00d4ff]">FLAC</span>
            <span className="text-xs px-3 py-1 rounded-full border border-[#00ff88] text-[#00ff88]">WAV</span>
          </div>
        </div>

        <div className="mb-6 p-4 bg-[#1e1e30] rounded-lg border border-[#333]">
          <h3 className="text-sm font-bold mb-3 text-[#ff8c00]">⚙ Pengaturan</h3>
          
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTargetType('user')}
              className={`flex-1 py-2 px-4 rounded-lg border ${targetType === 'user' ? 'bg-[#ff8c00] text-black border-[#ff8c00] font-bold' : 'bg-[#1e1e30] text-gray-400 border-[#333]'}`}
            >
              USER
            </button>
            <button
              onClick={() => setTargetType('group')}
              className={`flex-1 py-2 px-4 rounded-lg border ${targetType === 'group' ? 'bg-[#ff8c00] text-black border-[#ff8c00] font-bold' : 'bg-[#1e1e30] text-gray-400 border-[#333]'}`}
            >
              GROUP
            </button>
          </div>

          {targetType === 'user' ? (
            <div className="mb-3">
              <label className="block text-xs text-gray-400 mb-1">User ID</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full p-2 bg-[#1e1e30] border border-[#333] rounded-lg text-sm"
                placeholder="Masukkan User ID kamu"
              />
            </div>
          ) : (
            <div className="mb-3">
              <label className="block text-xs text-gray-400 mb-1">Group ID</label>
              <input
                type="text"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full p-2 bg-[#1e1e30] border border-[#333] rounded-lg text-sm"
                placeholder="Masukkan Group ID kamu"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1">API Key Roblox</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full p-2 bg-[#1e1e30] border border-[#333] rounded-lg text-sm"
              placeholder="Masukkan API Key dari create.roblox.com/credentials"
            />
          </div>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-[#333] rounded-lg p-8 text-center bg-[#1e1e30] mb-4"
        >
          <p className="text-4xl mb-2">🎵</p>
          <p className="text-sm mb-2">Drag & drop file audio di sini</p>
          <p className="text-xs text-gray-500 mb-4">atau</p>
          <label className="inline-block px-4 py-2 bg-[#ff8c00] text-black rounded-lg cursor-pointer hover:bg-[#ff9900] font-bold text-sm">
            Pilih File
            <input
              type="file"
              multiple
              accept=".mp3,.ogg,.flac,.wav,audio/*"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </div>

        {files.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-bold mb-2">File yang akan diupload ({files.length})</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between bg-[#1e1e30] p-2 rounded border border-[#333]">
                  <span className="text-sm truncate flex-1">{file.name}</span>
                  <button
                    onClick={() => removeFile(idx)}
                    className="ml-2 text-red-400 hover:text-red-300 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <button
            onClick={uploadFiles}
            disabled={uploading}
            className="w-full py-3 bg-[#ff8c00] text-black rounded-lg font-bold hover:bg-[#ff9900] disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {uploading ? '⏳ Uploading...' : '⬆ Upload Semua'}
          </button>
        )}

        {results.length > 0 && (
          <div className="bg-[#1e1e30] rounded-lg border border-[#333] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Hasil Upload</h3>
              <button
                onClick={copyResults}
                className="text-xs px-3 py-1 bg-[#333] hover:bg-[#444] rounded"
              >
                📋 Copy Hasil
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.map((result, idx) => (
                <div key={idx} className={`p-2 rounded text-sm ${result.success ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
                  <div className="font-medium">{result.name}</div>
                  {result.success ? (
                    <div className="text-xs text-green-400">Asset ID: {result.assetId}</div>
                  ) : (
                    <div className="text-xs text-red-400">{result.error}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-500">
          <p>Pastikan API Key memiliki permission: Asset:Read & Asset:Write</p>
          <p className="mt-1">Akun Roblox harus sudah ID Verified</p>
        </div>
      </div>
    </div>
  );
}
