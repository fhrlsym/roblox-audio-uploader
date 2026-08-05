'use client';

import { useState, useEffect } from 'react';
import { get, set, del } from 'idb-keyval';
import { RawAudioFile, TunedAudioFile } from '../types/audio';

const IDB_KEY_TUNED = 'audioUploader_tunedFiles';

export function useAudioQueue() {
  const [rawFiles, setRawFiles] = useState<RawAudioFile[]>([]);
  const [tunedFiles, setTunedFiles] = useState<TunedAudioFile[]>([]);
  const [activeStep, setActiveStep] = useState(1);

  // Restore tuned audio files from IndexedDB auto-backup on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await get<TunedAudioFile[]>(IDB_KEY_TUNED);
        if (saved && Array.isArray(saved) && saved.length > 0) {
          setTunedFiles(saved);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // Sync tuned audio files to IndexedDB auto-backup whenever tunedFiles changes
  useEffect(() => {
    (async () => {
      try {
        if (tunedFiles.length > 0) {
          await set(IDB_KEY_TUNED, tunedFiles);
        } else {
          await del(IDB_KEY_TUNED);
        }
      } catch {
        // ignore
      }
    })();
  }, [tunedFiles]);

  const addRawFiles = (files: RawAudioFile[]) => {
    setRawFiles((prev) => [...prev, ...files]);
  };

  const removeRawFile = (id: string) => {
    setRawFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const addTunedFiles = (tuned: TunedAudioFile[]) => {
    setTunedFiles((prev) => [...prev, ...tuned]);
  };

  const removeTunedFile = (id: string) => {
    setTunedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearTunedFiles = () => {
    setTunedFiles([]);
  };

  const goToStep = (stepId: number) => {
    setActiveStep(stepId);
  };

  return {
    rawFiles,
    tunedFiles,
    activeStep,
    addRawFiles,
    removeRawFile,
    addTunedFiles,
    removeTunedFile,
    clearTunedFiles,
    goToStep,
  };
}
