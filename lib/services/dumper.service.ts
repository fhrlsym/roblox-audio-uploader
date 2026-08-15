export interface DetectionResult {
  engine: string;
  confidence: number;
  signatures: string[];
}

export interface DumpResult {
  success: boolean;
  deobfuscatedCode: string;
  engineUsed: string;
  httpLogs?: string[];
  constants?: Record<string, unknown>;
  executionTimeMs?: number;
  error?: string;
}

export interface EngineStatus {
  id: string;
  name: string;
  available: boolean;
}

export class DumperService {
  private static base = '/api/dumper';

  static async detect(code: string): Promise<DetectionResult> {
    const res = await fetch(`${this.base}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error('Detection failed');
    const data = await res.json();
    return data.detection;
  }

  static async run(code: string, engine?: string): Promise<DumpResult> {
    const res = await fetch(`${this.base}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, engine }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Dump failed');
    }
    return res.json();
  }

  static async getStatus(): Promise<EngineStatus[]> {
    const res = await fetch(`${this.base}/status`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.engines || [];
  }
}