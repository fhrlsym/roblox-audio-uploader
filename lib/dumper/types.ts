export type DumperEngine =
  | 'auto'
  | 'wearedevs-deobf'
  | 'moonveil-devirt'
  | 'luraph-v14'
  | 'luraph-25ms'
  | 'prometheus-ast'
  | 'ironbrew-deobf'
  | 'mimic-sandbox'
  | 'httplog-interceptor'
  | 'revea-env'
  | 'bytearray-unpacker'
  | 'generic-vm';

export interface DetectionResult {
  engine: DumperEngine;
  engineName: string;
  obfuscator: string;
  version?: string;
  confidence: number;
  description: string;
  features: string[];
  suggestedAction: string;
}

export interface HttpLogEntry {
  id: string;
  url: string;
  method: string;
  bodySnippet?: string;
  timestamp: string;
  interceptedType: 'HttpGet' | 'HttpPost' | 'request' | 'syn.request' | 'http_request' | 'Webhook';
}

export interface ConstantEntry {
  id: string;
  type: 'string' | 'number' | 'boolean' | 'url' | 'identifier' | 'asset_id';
  value: string;
  raw?: string;
  occurrences: number;
  isSensitive?: boolean;
}

export interface VMTraceEntry {
  line: number;
  opcode: string;
  registers: Record<string, string>;
  description?: string;
}

export interface DumpExecutionResult {
  success: boolean;
  deobfuscatedCode: string;
  engineUsed: string;
  obfuscatorDetected: string;
  executionTimeMs: number;
  httpLogs: HttpLogEntry[];
  constants: ConstantEntry[];
  vmTraces?: VMTraceEntry[];
  summary: {
    totalLinesOriginal: number;
    totalLinesDumped: number;
    constantsExtracted: number;
    httpCallsIntercepted: number;
    payloadsExtracted: number;
  };
  error?: string;
}
