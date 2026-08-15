import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RawFile {
  id: string;
  name: string;
  file?: File;
  fileId?: string;
  duration?: number;
  source: 'file' | 'youtube' | 'soundcloud';
  sourceUrl?: string;
  thumbnail?: string;
  channel?: string;
}

export interface TunedFile {
  id: string;
  originalName: string;
  speed: number;
  amplify: number;
  blob?: Blob;
  blobUrl?: string;
  duration?: number;
}

export type AudioStep = 1 | 2 | 3;

interface AudioState {
  activeStep: AudioStep;
  rawFiles: RawFile[];
  tunedFiles: TunedFile[];
  setStep: (step: AudioStep) => void;
  addRawFiles: (files: RawFile[]) => void;
  removeRawFile: (id: string) => void;
  clearRawFiles: () => void;
  addTunedFiles: (files: TunedFile[]) => void;
  removeTunedFile: (id: string) => void;
  clearTunedFiles: () => void;
  clearAll: () => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      activeStep: 1,
      rawFiles: [],
      tunedFiles: [],
      setStep: (step) => set({ activeStep: step }),
      addRawFiles: (files) =>
        set((state) => ({
          rawFiles: [...state.rawFiles, ...files.filter((f) => !state.rawFiles.some((r) => r.id === f.id))],
        })),
      removeRawFile: (id) =>
        set((state) => ({ rawFiles: state.rawFiles.filter((f) => f.id !== id) })),
      clearRawFiles: () => set({ rawFiles: [] }),
      addTunedFiles: (files) =>
        set((state) => ({
          tunedFiles: [
            ...state.tunedFiles,
            ...files.filter(
              (f) =>
                !state.tunedFiles.some(
                  (t) => t.originalName === f.originalName && t.speed === f.speed && t.amplify === f.amplify
                )
            ),
          ],
        })),
      removeTunedFile: (id) =>
        set((state) => ({ tunedFiles: state.tunedFiles.filter((f) => f.id !== id) })),
      clearTunedFiles: () => set({ tunedFiles: [] }),
      clearAll: () => set({ rawFiles: [], tunedFiles: [], activeStep: 1 }),
    }),
    {
      name: 's2_audio_queue',
      partialize: (state) => ({ rawFiles: [], tunedFiles: [], activeStep: state.activeStep }),
    }
  )
);