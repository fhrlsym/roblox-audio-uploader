'use client';

import { useState } from 'react';
import { RawAudioFile, TunedAudioFile } from '../types/audio';
import { processAudio } from '../lib/audioProcessor';

interface TuningSectionProps {
  rawFiles: RawAudioFile[];
  onTuningComplete: (tunedFiles: TunedAudioFile[]) => void;
  onRemoveRaw: (id: string) => void;
}

export default function TuningSection({ rawFiles, onTuningComplete, onRemoveRaw }: TuningSectionProps) {
  const [speed, setSpeed] = useState(2.3);
  const [amplify, setAmplify] = useState(-4);
  const [tuning, setTuning] = useState(false);
  const [progress, setProgress] = useState(0);

  const calculateRobloxSpeed = () => (1 / speed).toFixed(4);

  const handleTuneAll = async () => {
    if (rawFiles.length === 0) return;

    setTuning(true);
    setProgress(0);

    const results: TunedAudioFile[] = [];

    for (let i = 0; i < rawFiles.length; i++) {
      const raw = rawFiles[i];
      
      try {
        let blob: Blob;

        if (raw.file) {
          // File upload: process client-side
          blob = await processAudio(raw.file, speed, amplify, (p) => {
            setProgress(((i + p / 100) / rawFiles.length) * 100);
          });
        } else if (raw.fileId) {
          // YouTube: fetch dari backend, lalu process client-side
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/api/download-file/${raw.fileId}`);
          if (!response.ok) throw new Error('File expired or not found');
          
          const arrayBuffer = await response.arrayBuffer();
          const file = new File([arrayBuffer], raw.name, { type: 'audio/mpeg' });
          
          blob = await processAudio(file, speed, amplify, (p) => {
            setProgress(((i + p / 100) / rawFiles.length) * 100);
          });
        } else {
          continue;
        }

        const tunedName = raw.name.replace(/\.[^/.]+$/, '') + `_${speed}x_${amplify}dB.mp3`;

        results.push({
          id: `tuned_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          originalName: raw.name,
          tunedName,
          blob,
          speed,
          amplify,
          sourceId: raw.id,
        });

        setProgress(((i + 1) / rawFiles.length) * 100);
      } catch (error) {
        console.error(`Failed to tune ${raw.name}:`, error);
      }
    }

    onTuningComplete(results);
    setTuning(false);
    setProgress(0);
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">2. Audio Tuning</h2>

      {/* Raw Files List */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-300 mb-3">Raw Files ({rawFiles.length})</h3>
        {rawFiles.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No files yet. Upload or convert from YouTube first.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {rawFiles.map((file) => (
              <div key={file.id} className="bg-slate-800 rounded-lg p-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{file.name}</p>
                  {file.url && <p className="text-slate-500 text-xs truncate">{file.url}</p>}
                </div>
                <button
                  onClick={() => onRemoveRaw(file.id)}
                  className="ml-3 text-red-400 hover:text-red-300 transition"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="space-y-4 mb-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-slate-300 font-medium">Speed</label>
            <span className="text-blue-400 font-bold">{speed}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="text-slate-500 text-sm mt-1">
            Roblox PlaybackSpeed: <span className="text-yellow-400 font-mono">{calculateRobloxSpeed()}</span>
          </p>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-slate-300 font-medium">Amplify</label>
            <span className="text-green-400 font-bold">{amplify > 0 ? '+' : ''}{amplify} dB</span>
          </div>
          <input
            type="range"
            min="-20"
            max="20"
            step="1"
            value={amplify}
            onChange={(e) => setAmplify(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Tune Button */}
      <button
        onClick={handleTuneAll}
        disabled={tuning || rawFiles.length === 0}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg transition shadow-lg"
      >
        {tuning ? `Tuning... ${Math.round(progress)}%` : `Tune All Files (${rawFiles.length})`}
      </button>

      {tuning && (
        <div className="mt-3 bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
