// Tipe data terpusat untuk Roblox Audio Uploader

export interface VideoInfo {
  id: string;
  title: string;
  durationString: string;
  duration?: number;
  thumbnail: string;
  channel: string;
}

export interface RawAudioFile {
  id: string;
  name: string;
  file?: File;
  fileId?: string;
  url?: string;
  video?: VideoInfo;
  duration?: number;
  size?: number;
}

export interface TunedAudioFile {
  id: string;
  originalName: string;
  tunedName: string;
  blob: Blob;
  speed: number;
  amplify: number;
  duration?: number;
  sourceId: string;
}

export interface UploadResult {
  filename: string;
  assetId?: string;
  status?: string;
  error?: string;
  success: boolean;
}

export interface RobloxQuota {
  usage: number;
  capacity: number;
  period?: string;
}

export interface SavedAccount {
  id: string;
  name: string;
  type: 'user' | 'group';
  apiKey: string;
  cookie?: string;
  userId?: string;
  groupId?: string;
  displayName?: string;
  memberCount?: number;
  hasVerifiedBadge?: boolean;
  thumbnail?: string | null;
  ownerName?: string | null;
  quota?: RobloxQuota | null;
  createdAt?: number;
}

export interface UploadRecord {
  id: string;
  fileName: string;
  displayName: string;
  assetId: string;
  accountId?: string;
  accountName: string;
  uploadedAt: number;
  fileSize?: number;
  duration?: number;
  robloxPlaybackSpeed?: number | string;
  originalSpeed?: number;
  amplify?: number;
  status: string;
}

export interface UploadStats {
  total: number;
  active: number;
  pending: number;
  failed: number;
  copyright: number;
}

export interface SpoofRecord {
  id: string;
  originalAssetId: string;
  newAssetId?: string;
  assetType: string;
  title: string;
  status: 'Active' | 'Pending' | 'Failed';
  error?: string;
  createdAt: number;
}
