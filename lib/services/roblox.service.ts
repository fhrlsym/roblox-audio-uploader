const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export interface KeyInfo {
  keyName: string;
  owner: { id: string; type: 'User' | 'Group'; name: string; displayName: string };
  audioQuota?: { usage: number; capacity: number };
  groups: { id: string; name: string; memberCount: number; hasVerifiedBadge: boolean; thumbnail: string }[];
}

export interface QuotaInfo {
  usage: number;
  capacity: number;
  period: string;
  usageResetTime: string;
}

export interface SpoofItem {
  assetId: string;
  name?: string;
  assetType?: string;
  success?: boolean;
  newAssetId?: string;
  error?: string;
}

export class RobloxService {
  private static base = BACKEND_URL;

  static async getKeyInfo(apiKey: string): Promise<KeyInfo> {
    const res = await fetch(`${this.base}/api/roblox/key-info?apiKey=${encodeURIComponent(apiKey)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Invalid API key');
    }
    return res.json();
  }

  static async getQuota(apiKey: string, targetId: string, targetType: 'User' | 'Group'): Promise<QuotaInfo> {
    const params = new URLSearchParams({ apiKey, targetId, targetType });
    const res = await fetch(`${this.base}/api/roblox-quota?${params}`);
    if (!res.ok) return { usage: 0, capacity: 0, period: '', usageResetTime: '' };
    return res.json();
  }

  static async lookup(urlOrId: string): Promise<{ id: string; type: string; name: string; displayName?: string; thumbnail?: string }> {
    const isUrl = urlOrId.startsWith('http');
    const params = isUrl ? `url=${encodeURIComponent(urlOrId)}` : `id=${urlOrId}`;
    const res = await fetch(`${this.base}/api/roblox/lookup?${params}`);
    if (!res.ok) throw new Error('Lookup failed');
    const data = await res.json();
    return data.result;
  }

  static async spoofDirect(
    assetIds: string[],
    account?: { creatorType: string; creatorId: string; apiKey: string }
  ): Promise<SpoofItem[]> {
    const res = await fetch(`${this.base}/api/spoof-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetIds,
        ...(account ? { creatorType: account.creatorType, creatorId: account.creatorId, apiKey: account.apiKey } : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Spoof failed');
    }
    const data = await res.json();
    return data.items;
  }

  static async detectAsset(assetId: string): Promise<{ assetId: string; name: string; assetType: string }> {
    const res = await fetch(`${this.base}/api/spoof-detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId }),
    });
    if (!res.ok) throw new Error('Detection failed');
    return res.json();
  }

  static getAudioStreamUrl(assetId: string): string {
    return `${this.base}/api/spoof-audio-stream/${assetId}`;
  }

  static getDownloadUrl(assetId: string): string {
    return `${this.base}/api/spoof-download/${assetId}`;
  }
}