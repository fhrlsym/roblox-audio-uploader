export interface ObfuscatorSettings {
  encryptStrings?: boolean;
  proxifyLocals?: boolean;
  proxifyFunctions?: boolean;
  antiTamper?: boolean;
  controlFlowFlattening?: boolean;
  isLuauRuntime?: boolean;
  vmDepth?: number;
}

export interface ObfuscateResult {
  success: boolean;
  result: string;
  settings: ObfuscatorSettings;
  executionTimeMs: number;
  error?: string;
}

export class ObfuscatorService {
  private static base = '/api/obfuscator';

  static async obfuscate(source: string, settings?: ObfuscatorSettings): Promise<ObfuscateResult> {
    const res = await fetch(this.base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, settings }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Obfuscation failed');
    }
    return res.json();
  }
}