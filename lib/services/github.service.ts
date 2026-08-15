export interface GitHubMap {
  filename: string;
  displayName: string;
}

export interface CommitPayload {
  mapFilename: string;
  genre: string;
  songs: { name: string; assetId: string; speed?: number }[];
  isNewMap?: boolean;
  newMapName?: string;
  coverAssetId?: string;
}

export interface CommitResult {
  success: boolean;
  addedCount: number;
  updatedCount: number;
  totalCount: number;
  sha?: string;
}

export class GitHubService {
  private static base = '/api/github';

  static async getMaps(): Promise<GitHubMap[]> {
    const res = await fetch(`${this.base}/maps`);
    if (!res.ok) throw new Error('Failed to fetch maps');
    const data = await res.json();
    return data.maps || [];
  }

  static async getGenres(mapFile: string): Promise<string[]> {
    const res = await fetch(`${this.base}/genres?mapFile=${encodeURIComponent(mapFile)}`);
    if (!res.ok) throw new Error('Failed to fetch genres');
    const data = await res.json();
    return data.genres || [];
  }

  static async commit(payload: CommitPayload): Promise<CommitResult> {
    const res = await fetch(`${this.base}/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Commit failed');
    }
    return res.json();
  }
}