'use client';

import { useState, useEffect } from 'react';
import { supabase, AudioUpload } from '../lib/supabase';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const CORRECT_PIN = '515753';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [targetType, setTargetType] = useState<'user' | 'group'>('user');
  const [userId, setUserId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [apiKeys, setApiKeys] = useState<string[]>(['']);
  
  const [youtubeUrls, setYoutubeUrls] = useState('');
  const [speed, setSpeed] = useState(2.30);
  const [amplify, setAmplify] = useState(-4);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<any[]>([]);
  
  const [uploadHistory, setUploadHistory] = useState<AudioUpload[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [summary, setSummary] = useState({ total: 0, active: 0, pending: 0, failed: 0, copyright: 0 });

  useEffect(() => {
    const savedAuth = localStorage.getItem('audioUploader_auth');
    if (savedAuth === CORRECT_PIN) {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadUploadHistory();
      const interval = setInterval(loadUploadHistory, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const loadUploadHistory = async () => {
    const { data, error } = await supabase
      .from('audio_uploads')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (!error && data) {
      setUploadHistory(data);
      const total = data.length;
      const active = data.filter(d => d.status === 'Active').length;
      const pending = data.filter(d => d.status === 'Pending').length;
      const failed = data.filter(d => d.status === 'Failed').length;
      const copyright = data.filter(d => d.status === 'Copyright').length;
      setSummary({ total, active, pending, failed, copyright });
    }
  };

  const saveToDatabase = async (assetId: string, name: string, status: string, youtubeUrl?: string) => {
    await supabase.from('audio_uploads').insert({
      asset_id: assetId,
      name: name,
      status: status,
      original_speed: speed,
      amplify: amplify,
      roblox_playback_speed: parseFloat(calculateRobloxPlaybackSpeed()),
      youtube_url: youtubeUrl || null,
      uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await loadUploadHistory();
  };

  const updateAssetStatus = async (assetId: string, status: string) => {
    await supabase
      .from('audio_uploads')
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq('asset_id', assetId);
    await loadUploadHistory();
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === CORRECT_PIN) {
      setIsAuthenticated(true);
      localStorage.setItem('audioUploader_auth', CORRECT_PIN);
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const calculateRobloxPlaybackSpeed = () => {
    return (1 / speed).toFixed(4);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
      ['audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/wav', 'audio/mp3'].includes(file.type) ||
      file.name.endsWith('.mp3') || file.name.endsWith('.ogg') || file.name.endsWith('.flac') || file.name.endsWith('.wav')
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

  const addApiKeyField = () => {
    setApiKeys(prev => [...prev, '']);
  };

  const updateApiKey = (index: number, value: string) => {
    setApiKeys(prev => prev.map((key, i) => i === index ? value : key));
  };

  const removeApiKeyField = (index: number) => {
    if (apiKeys.length > 1) {
      setApiKeys(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleYoutubeDownload = async () => {
    const urls = youtubeUrls.split('\n').filter(url => url.trim());
    if (urls.length === 0) {
      alert('Please enter at least one YouTube URL');
      return;
    }

    setDownloading(true);
    setDownloadProgress([]);

    for (const url of urls) {
      try {
        setDownloadProgress(prev => [...prev, { url, status: 'downloading', progress: 0 }]);
        
        const response = await fetch(`${BACKEND_URL}/api/youtube-download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim(), speed, amplify }),
        });

        const data = await response.json();
        
        if (data.success) {
          const fileResponse = await fetch(`${BACKEND_URL}/api/download-file/${data.fileId}`);
          const blob = await fileResponse.blob();
          const file = new File([blob], data.filename, { type: 'audio/mpeg' });
          setFiles(prev => [...prev, file]);
          
          setDownloadProgress(prev => 
            prev.map(p => p.url === url ? { ...p, status: 'completed', progress: 100 } : p)
          );
        } else {
          setDownloadProgress(prev => 
            prev.map(p => p.url === url ? { ...p, status: 'failed', progress: 0 } : p)
          );
        }
      } catch (error) {
        setDownloadProgress(prev => 
          prev.map(p => p.url === url ? { ...p, status: 'failed', progress: 0 } : p)
        );
      }
    }

    setDownloading(false);
  };

  const uploadToRoblox = async () => {
    if (files.length === 0) {
      alert('Please select files or download from YouTube first');
      return;
    }

    const validApiKeys = apiKeys.filter(key => key.trim());
    if (validApiKeys.length === 0) {
      alert('Please enter at least one API key');
      return;
    }

    if (targetType === 'user' && !userId.trim()) {
      alert('Please enter User ID');
      return;
    }

    if (targetType === 'group' && !groupId.trim()) {
      alert('Please enter Group ID');
      return;
    }

    setUploading(true);
    setResults([]);

    const uploadResults: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const apiKey = validApiKeys[i % validApiKeys.length];

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('assetType', 'Audio');
        formData.append('displayName', file.name.replace(/\.[^/.]+$/, ''));
        formData.append('description', `Speed: ${speed}x | Amplify: ${amplify}dB | Roblox Playback: ${calculateRobloxPlaybackSpeed()}`);
        formData.append('creatorType', targetType);
        formData.append('creatorId', targetType === 'group' ? groupId : userId);
        formData.append('apiKey', apiKey);

        const response = await fetch(`${BACKEND_URL}/api/upload-to-roblox`, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (response.ok && result.assetId) {
          const status = await checkAssetStatus(result.assetId, apiKey);
          uploadResults.push({
            filename: file.name,
            assetId: result.assetId,
            status: status,
            success: true,
          });
          
          const youtubeUrl = youtubeUrls.split('\n')[i]?.trim() || undefined;
          await saveToDatabase(result.assetId, file.name, status, youtubeUrl);
        } else {
          uploadResults.push({
            filename: file.name,
            error: result.error || result.message || 'Upload failed',
            success: false,
          });
        }
      } catch (error: any) {
        uploadResults.push({
          filename: file.name,
          error: error.message,
          success: false,
        });
      }
    }

    setResults(uploadResults);
    setUploading(false);
    setFiles([]);
    setYoutubeUrls('');
  };

  const checkAssetStatus = async (assetId: string, apiKey: string): Promise<string> => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/asset-status/${assetId}?apiKey=${encodeURIComponent(apiKey)}`
      );

      const data = await response.json();

      if (data.moderationResult) {
        if (data.moderationResult.moderationState === 'Rejected') {
          return 'Copyright';
        }
      }

      if (data.status) return data.status;
      if (data.state === 'Active') return 'Active';
      if (data.state === 'Pending') return 'Pending';
      return 'Failed';
    } catch {
      return 'Pending';
    }
  };

  const refreshStatus = async (assetId: string) => {
    const validApiKey = apiKeys.find(key => key.trim());
    if (!validApiKey) return;

    const status = await checkAssetStatus(assetId, validApiKey);
    await updateAssetStatus(assetId, status);
  };

  const copyResults = () => {
    const text = results
      .filter(r => r.success)
      .map(r => `${r.filename}: rbxassetid://${r.assetId} (${r.status})`)
      .join('\n');
    navigator.clipboard.writeText(text);
    alert('Results copied to clipboard!');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
              Roblox Audio Uploader
            </h1>
            <p className="text-gray-400 text-sm">Enter PIN to continue</p>
          </div>
          
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter 6-digit PIN"
                maxLength={6}
                className={`w-full px-4 py-3 bg-gray-900/50 border ${pinError ? 'border-red-500' : 'border-gray-700'} rounded-xl text-white text-center text-2xl tracking-widest focus:outline-none focus:border-blue-500 transition-colors`}
                autoFocus
              />
              {pinError && (
                <p className="text-red-400 text-sm mt-2 text-center">Incorrect PIN</p>
              )}
            </div>
            
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-6 shadow-2xl">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Roblox Audio Uploader
          </h1>
          <p className="text-gray-400">YouTube Converter + Batch Upload</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl p-4">
            <div className="text-3xl font-bold text-green-400">{summary.total}</div>
            <div className="text-gray-400 text-sm">Total Uploads</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl p-4">
            <div className="text-3xl font-bold text-blue-400">{summary.active}</div>
            <div className="text-gray-400 text-sm">Active</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl p-4">
            <div className="text-3xl font-bold text-yellow-400">{summary.pending}</div>
            <div className="text-gray-400 text-sm">Pending</div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-4">Audio Settings</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Speed (Playback)</label>
              <input
                type="number"
                step="0.01"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Amplify (dB)</label>
              <input
                type="number"
                step="1"
                value={amplify}
                onChange={(e) => setAmplify(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <p className="text-blue-400 text-sm">
              Roblox Playback Speed: <span className="font-mono font-bold">{calculateRobloxPlaybackSpeed()}</span>
            </p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-4">YouTube URLs (one per line)</h2>
          <textarea
            value={youtubeUrls}
            onChange={(e) => setYoutubeUrls(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            rows={5}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
          />
          <button
            onClick={handleYoutubeDownload}
            disabled={downloading}
            className="mt-4 w-full py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg"
          >
            {downloading ? 'Downloading & Converting...' : 'Download & Convert to MP3'}
          </button>

          {downloadProgress.length > 0 && (
            <div className="mt-4 space-y-2">
              {downloadProgress.map((item, index) => (
                <div key={index} className="p-3 bg-gray-900/50 rounded-lg">
                  <div className="text-sm text-gray-400 truncate">{item.url}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Status: <span className={item.status === 'completed' ? 'text-green-400' : item.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-4">Upload Files</h2>
          
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <p className="text-gray-400 mb-2">Drag & drop files or click to browse</p>
            <p className="text-xs text-gray-500">MP3, OGG, FLAC, WAV supported</p>
            <input
              id="fileInput"
              type="file"
              multiple
              accept="audio/*"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-400">Selected Files ({files.length})</h3>
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <span className="text-sm truncate flex-1">{file.name}</span>
                  <button
                    onClick={() => removeFile(index)}
                    className="ml-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-4">Roblox Settings</h2>
          
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setTargetType('user')}
              className={`flex-1 py-2 rounded-xl font-semibold transition-all ${
                targetType === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              User
            </button>
            <button
              onClick={() => setTargetType('group')}
              className={`flex-1 py-2 rounded-xl font-semibold transition-all ${
                targetType === 'group'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              Group
            </button>
          </div>

          {targetType === 'user' ? (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">User ID</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter Roblox User ID"
                className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Group ID</label>
              <input
                type="text"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                placeholder="Enter Roblox Group ID"
                className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-400">API Keys</label>
              <button
                onClick={addApiKeyField}
                className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-xs"
              >
                + Add Key
              </button>
            </div>
            
            {apiKeys.map((key, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="password"
                  value={key}
                  onChange={(e) => updateApiKey(index, e.target.value)}
                  placeholder={`API Key ${index + 1}`}
                  className="flex-1 px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
                {apiKeys.length > 1 && (
                  <button
                    onClick={() => removeApiKeyField(index)}
                    className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={uploadToRoblox}
          disabled={uploading}
          className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold text-lg rounded-2xl transition-all duration-200 shadow-2xl hover:shadow-blue-500/50"
        >
          {uploading ? 'Uploading...' : 'Upload to Roblox'}
        </button>

        {results.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Upload Results</h2>
              <button
                onClick={copyResults}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-xl text-sm font-semibold"
              >
                Copy Results
              </button>
            </div>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl ${
                    result.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
                  }`}
                >
                  <div className="font-semibold text-sm">{result.filename}</div>
                  {result.success ? (
                    <>
                      <div className="text-xs text-gray-400 mt-1 font-mono">
                        rbxassetid://{result.assetId}
                      </div>
                      <div className={`text-xs mt-1 ${
                        result.status === 'Active' ? 'text-green-400' :
                        result.status === 'Pending' ? 'text-yellow-400' :
                        result.status === 'Copyright' ? 'text-red-400' :
                        'text-gray-400'
                      }`}>
                        Status: {result.status}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-red-400 mt-1">{result.error}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Upload History</h2>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm"
            >
              {showHistory ? 'Hide' : 'Show'}
            </button>
          </div>

          {showHistory && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {uploadHistory.map((item) => (
                <div key={item.id} className="p-4 bg-gray-900/50 rounded-xl border border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{item.name}</div>
                      <div className="text-xs text-gray-400 font-mono mt-1">
                        rbxassetid://{item.asset_id}
                      </div>
                      {item.youtube_url && (
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          {item.youtube_url}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-2">
                        Speed: {item.original_speed}x | Amplify: {item.amplify}dB | Roblox: {item.roblox_playback_speed}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(item.uploaded_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        item.status === 'Active' ? 'bg-green-500/20 text-green-400' :
                        item.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        item.status === 'Copyright' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {item.status}
                      </span>
                      {item.status === 'Pending' && (
                        <button
                          onClick={() => refreshStatus(item.asset_id)}
                          className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-xs"
                        >
                          Refresh
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
