'use client';

import { useState, useEffect } from 'react';
import { get, set, del } from 'idb-keyval';
import { RawAudioFile, TunedAudioFile } from '../types/audio';

const IDB_KEY_TUNED = 'audioUploader_tunedFiles';
const IDB_KEY_TIMESTAMP = 'audioUploader_tunedFiles_ts';
const MAX_TUNED_AGE = 24 * 60 * 60 * 1000; // 24 hours

export function useAudioQueue() {
  const [rawFiles, setRawFiles] = useState<RawAudioFile[]>([]);
  const [tunedFiles, setTunedFiles] = useState<TunedAudioFile[]>([]);
  const [activeStep, setActiveStep] = useState(1);

  // Restore tuned audio files from IndexedDB auto-backup on mount (with 24h expiry)
  useEffect(() => {
    (async () => {
      try {
        const saved = await get<TunedAudioFile[]>(IDB_KEY_TUNED);
        const savedTs = await get<number>(IDB_KEY_TIMESTAMP);
        if (saved && Array.isArray(saved) && saved.length > 0) {
          // Auto-expire: discard if older than 24 hours
          if (savedTs && Date.now() - savedTs > MAX_TUNED_AGE) {
            await del(IDB_KEY_TUNED);
            await del(IDB_KEY_TIMESTAMP);
          } else {
            setTunedFiles(saved);
          }
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
          await set(IDB_KEY_TIMESTAMP, Date.now());
        } else {
          await del(IDB_KEY_TUNED);
          await del(IDB_KEY_TIMESTAMP);
        }
      } catch {
        // ignore
      }
    })();
  }, [tunedFiles]);

  const addRawFiles = (files: RawAudioFile[]) => {
    setRawFiles((prev) => {
      // Dedup only by id: ids are always freshly generated, and name-based dedup
      // would silently drop a *different* file that merely shares its filename.
      const existingIds = new Set(prev.map((f) => f.id));
      const newFiles = files.filter((f) => !existingIds.has(f.id));
      return [...prev, ...newFiles];
    });
  };

  const removeRawFile = (id: string) => {
    setRawFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const addTunedFiles = (tuned: TunedAudioFile[]) => {
    setTunedFiles((prev) => {
      // Dedup on (originalName, speed, amplify): only genuine duplicates — the same
      // song re-added and re-tuned with identical settings — are replaced. Distinct
      // files that share a filename, or re-tunes at different settings, are kept.
      const incomingKeys = new Set(tuned.map((t) => `${t.originalName}::${t.speed}::${t.amplify}`));
      const filteredPrev = prev.filter((p) => !incomingKeys.has(`${p.originalName}::${p.speed}::${p.amplify}`));
      return [...filteredPrev, ...tuned];
    });
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
