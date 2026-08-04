// Raw audio file (belum di-tune)
export interface RawAudioFile {
  id: string;
  name: string;
  file?: File; // untuk file upload
  fileId?: string; // untuk YouTube download (backend fileId)
  url?: string; // YouTube URL
  video?: string; // YouTube video title
  duration?: number;
  size?: number;
}

// Tuned audio file (sudah di-tune dengan playbackRate)
export interface TunedAudioFile {
  id: string;
  originalName: string;
  tunedName: string;
  blob: Blob;
  speed: number;
  amplify: number;
  duration?: number;
  sourceId: string; // reference ke RawAudioFile.id
}

// Upload result
export interface UploadResult {
  filename: string;
  assetId?: string;
  status?: string;
  error?: string;
  success: boolean;
}
