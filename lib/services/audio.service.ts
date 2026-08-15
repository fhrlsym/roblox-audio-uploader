const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export interface YoutubeInfo {
  id: string;
  title: string;
  durationString: string;
  duration: number;
  thumbnail: string;
  channel: string;
}

export interface SoundCloudInfo {
  id: string;
  title: string;
  username: string;
  duration: number;
  artwork: string;
  genre: string;
}

export interface AudioFile {
  id: string;
  name: string;
  file?: File;
  fileId?: string;
  duration?: number;
}

export interface UploadResult {
  success: boolean;
  filename?: string;
  operationId?: string;
  assetId?: string;
  error?: string;
}

export class AudioService {
  private static base = BACKEND_URL;

  static async fetchYoutubeInfo(url: string, cookies?: string): Promise<YoutubeInfo> {
    const res = await fetch(`${this.base}/api/youtube-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, cookies }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch YouTube info');
    }
    const data = await res.json();
    return data.video;
  }

  static async downloadYoutube(url: string, cookies?: string, speed?: number, amplify?: number): Promise<{ filename: string; fileId: string }> {
    const res = await fetch(`${this.base}/api/youtube-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, cookies, speed, amplify }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to download YouTube audio');
    }
    return res.json();
  }

  static async fetchSoundCloudInfo(url: string): Promise<SoundCloudInfo> {
    const res = await fetch(`${this.base}/api/soundcloud-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch SoundCloud info');
    }
    const data = await res.json();
    return data.audio;
  }

  static async downloadSoundCloud(url: string): Promise<{ filename: string; fileId: string }> {
    const res = await fetch(`${this.base}/api/soundcloud-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to download SoundCloud audio');
    }
    return res.json();
  }

  static async searchYoutube(query: string, cookies?: string): Promise<YoutubeInfo | null> {
    const params = new URLSearchParams({ q: query });
    if (cookies) params.set('cookies', cookies);
    const res = await fetch(`${this.base}/api/youtube-search?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.video || null;
  }

  static async uploadToRoblox(
    file: Blob,
    displayName: string,
    account: { creatorType: string; creatorId: string; apiKey: string },
    description?: string
  ): Promise<string> {
    const form = new FormData();
    form.append('file', file, `${displayName}.mp3`);
    form.append('displayName', displayName);
    form.append('description', description || '');
    form.append('creatorType', account.creatorType);
    form.append('creatorId', account.creatorId);
    form.append('apiKey', account.apiKey);

    const res = await fetch(`${this.base}/api/upload-to-roblox`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Upload failed');
    }
    const data = await res.json();
    return data.operationId;
  }

  static async uploadConverted(
    fileId: string,
    displayName: string,
    account: { creatorType: string; creatorId: string; apiKey: string },
    description?: string
  ): Promise<string> {
    const res = await fetch(`${this.base}/api/upload-converted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, displayName, description, ...account }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Upload failed');
    }
    const data = await res.json();
    return data.operationId;
  }

  static async checkOperationStatus(operationId: string, apiKey: string): Promise<{ done: boolean; assetId?: string; status?: string; error?: string }> {
    const res = await fetch(`${this.base}/api/operation-status/${operationId}?apiKey=${encodeURIComponent(apiKey)}`);
    if (!res.ok) return { done: false };
    return res.json();
  }

  static async checkAssetStatus(assetId: string, apiKey: string): Promise<{ status: string }> {
    const res = await fetch(`${this.base}/api/asset-status/${assetId}?apiKey=${encodeURIComponent(apiKey)}`);
    if (!res.ok) return { status: 'Unknown' };
    return res.json();
  }

  static getDownloadUrl(fileId: string): string {
    return `${this.base}/api/download-file/${fileId}`;
  }

  static async pollOperation(
    operationId: string,
    apiKey: string,
    maxAttempts = 60,
    interval = 1000
  ): Promise<{ assetId?: string; status?: string; error?: string }> {
    for (let i = 0; i < maxAttempts; i++) {
      const result = await this.checkOperationStatus(operationId, apiKey);
      if (result.done) return result;
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error('Operation timed out');
  }
}