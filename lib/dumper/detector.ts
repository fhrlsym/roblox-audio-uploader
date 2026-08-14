import { DetectionResult, DumperEngine } from './types';

export function detectObfuscator(code: string): DetectionResult {
  const src = String(code || '').trim();

  if (!src) {
    return {
      engine: 'mimic-sandbox',
      engineName: 'Universal Mimic Sandbox',
      obfuscator: 'Empty Script',
      confidence: 0,
      description: 'Tempelkan script Luau/Lua untuk memulai analisa signature otomatis.',
      features: [],
      suggestedAction: 'Paste kode Anda pada editor input.',
    };
  }

  // 1. Luraph Detection (v11, v12, v13, v14.7+)
  const isLuraphV14 =
    /Luraph\s+Obfuscator\s+v14/i.test(src) ||
    /_LPH_SRC\s*=/i.test(src) ||
    (/LPH_/i.test(src) && /SCRIPT_KEY/i.test(src)) ||
    (src.includes('does your environment support') && src.includes('LPH_'));

  const isLuraphLegacy =
    /Luraph\s+Obfuscator/i.test(src) ||
    /LPH_/i.test(src) ||
    /\(does your environment support/i.test(src) ||
    /LPH_OBFUSCATED/i.test(src);

  if (isLuraphV14) {
    return {
      engine: 'luraph-v14',
      engineName: 'Luraph v14.x Proto & String Dumper',
      obfuscator: 'Luraph Obfuscator',
      version: 'v14.7+',
      confidence: 99,
      description: 'Terdeteksi proteksi Luraph modern v14.x dengan VM register dispatch dan string pool hashing.',
      features: ['LPH_ Token Header', 'GC Proto Extraction', 'Hex Bytecode Stream'],
      suggestedAction: 'Gunakan engine Luraph v14 untuk mendownload proto dan string terdekripsi.',
    };
  }

  if (isLuraphLegacy) {
    return {
      engine: 'luraph-25ms',
      engineName: '25ms Luraph Dumper Engine',
      obfuscator: 'Luraph Obfuscator',
      version: 'v11 - v13.x',
      confidence: 96,
      description: 'Terdeteksi proteksi Luraph standar dengan bitwise unwrap dan dynamic constant array.',
      features: ['Luraph Bitwise Unwrapper', 'Loadstring Trap', 'Metatable Interceptor'],
      suggestedAction: 'Gunakan engine 25ms Luraph Dumper untuk membongkar VM ke kode asli.',
    };
  }

  // 2. Moonveil Detection
  const isMoonveil =
    /Moonveil/i.test(src) ||
    /_MOONVEIL/i.test(src) ||
    (src.includes('moonveil') && src.includes('getgenv')) ||
    (/local\s+[a-zA-Z0-9_]+\s*=\s*\{[0-9,\s]+\}\s*;?\s*local\s+[a-zA-Z0-9_]+\s*=\s*getfenv/i.test(src) && src.length > 5000 && /bit32/i.test(src));

  if (isMoonveil) {
    return {
      engine: 'moonveil-devirt',
      engineName: 'Moonveil VM Devirtualizer',
      obfuscator: 'Moonveil Obfuscator',
      version: 'v2 / Modern',
      confidence: 95,
      description: 'Terdeteksi proteksi Moonveil dengan virtual register stack dan control flow flattening.',
      features: ['Register Lifter', 'Trace Reconstructor', 'AST Decompile Engine'],
      suggestedAction: 'Gunakan Moonveil Devirtualizer untuk mengangkat register VM menjadi Luau AST asli.',
    };
  }

  // 3. Prometheus Detection
  const isPrometheus =
    /IllIIl|IIlllI|lIIlIl|IlIlIl/i.test(src) ||
    /ConstantArray/i.test(src) ||
    /ProxifyLocals/i.test(src) ||
    /NumbersToExpressions/i.test(src) ||
    (/local\s+IllI/i.test(src) && src.includes('table.concat'));

  if (isPrometheus) {
    return {
      engine: 'prometheus-ast',
      engineName: 'Prometheus AST Unparser',
      obfuscator: 'Prometheus Obfuscator',
      version: 'AST Pipeline',
      confidence: 94,
      description: 'Terdeteksi obfuscation Prometheus berbasis manipulasi Abstract Syntax Tree dan mangled identifiers.',
      features: ['Mangled Name Beautifier', 'ConstantArray Solver', 'Scope Unfolder'],
      suggestedAction: 'Gunakan Prometheus AST Unparser untuk merekonstruksi nama variabel dan ekspresi.',
    };
  }

  // 4. IronBrew 1 & 2 Detection
  const isIronBrew =
    /IronBrew/i.test(src) ||
    (/local\s+function\s+[a-zA-Z0-9_]+\s*\([^)]*\)\s*local\s+[a-zA-Z0-9_]+\s*=\s*bit32\.bxor/i.test(src) && src.includes('\\x')) ||
    (src.includes('deserialize') && src.includes('bit32') && src.includes('string.sub'));

  if (isIronBrew) {
    return {
      engine: 'ironbrew-deobf',
      engineName: 'IronBrew VM Deserializer',
      obfuscator: 'IronBrew',
      version: 'v1 / v2',
      confidence: 93,
      description: 'Terdeteksi proteksi IronBrew dengan opcode deserializer dan enkripsi string XOR multi-tahap.',
      features: ['Opcode Table Decompiler', 'XOR String Unpacker', 'Bytecode Slicer'],
      suggestedAction: 'Gunakan IronBrew Deobfuscator untuk mengekstrak instruksi VM dan string pool.',
    };
  }

  // 5. WeAreDevs / Simple Byte Array / String.char Array
  const isByteArray =
    (/string\.char\s*\(\s*[0-9\s,]+\s*\)/i.test(src) && src.length > 500) ||
    (/table\.concat\s*\(\s*\{[0-9\s,"]+\}\s*\)/i.test(src)) ||
    (/loadstring\s*\(\s*table\.concat/i.test(src)) ||
    (/loadstring\s*\(\s*string\.char/i.test(src));

  if (isByteArray) {
    return {
      engine: 'bytearray-unpacker',
      engineName: 'Byte Array & Char Unpacker',
      obfuscator: 'Bytecode / Char Array Obfuscator',
      version: 'Simple Encoded',
      confidence: 92,
      description: 'Terdeteksi script terenkripsi menggunakan kumpulan karakter numerik (string.char / byte tables).',
      features: ['Instant Byte Decoder', 'Char Array Evaluator', 'Loadstring Unpacker'],
      suggestedAction: 'Gunakan Byte Array Unpacker untuk langsung mengonversi angka byte menjadi kode teks.',
    };
  }

  // 6. External Loader & HTTP Interceptor
  const isExternalLoader =
    /game\s*:\s*HttpGet/i.test(src) ||
    /syn\.request/i.test(src) ||
    /http_request/i.test(src) ||
    /request\s*\(\s*\{/i.test(src) ||
    /discord\.com\/api\/webhooks/i.test(src);

  if (isExternalLoader) {
    return {
      engine: 'httplog-interceptor',
      engineName: '25ms HTTP & Webhook Interceptor',
      obfuscator: 'External Loader / Script Hub',
      version: 'Network Hub',
      confidence: 90,
      description: 'Terdeteksi script loader yang memanggil resource eksternal atau mengirim log webhook.',
      features: ['HttpGet Sniffer', 'Webhook URL Extractor', 'Raw Script Auto-Fetcher'],
      suggestedAction: 'Gunakan 25ms HTTP Interceptor untuk menangkap link script rahasia dan payload.',
    };
  }

  // 7. Revea / Environment Hooks
  const isEnvLoggerTarget =
    /getgenv\(\)/i.test(src) ||
    /getrenv\(\)/i.test(src) ||
    /hookmetamethod/i.test(src) ||
    /hookfunction/i.test(src) ||
    /getrawmetatable/i.test(src);

  if (isEnvLoggerTarget) {
    return {
      engine: 'revea-env',
      engineName: 'Revea.lol & Kolenv Memory Dumper',
      obfuscator: 'Environment Hooking Script',
      version: 'Memory Hooks',
      confidence: 85,
      description: 'Terdeteksi script yang memodifikasi metatable, hook metamethod, atau environment global.',
      features: ['Global Hook Logger', 'Metamethod Trapper', 'Closure Inspector'],
      suggestedAction: 'Gunakan Revea Memory Dumper untuk mencatat modifikasi environment global.',
    };
  }

  // 8. Generic / Unknown Luau VM (Fallback to Mimic V3 Universal)
  return {
    engine: 'mimic-sandbox',
    engineName: 'Mimic V3 Universal Sandbox',
    obfuscator: 'Generic / Custom Luau Obfuscator',
    version: 'Universal VM',
    confidence: 80,
    description: 'Format script tidak terdaftar pada signature spesifik, menggunakan sandbox emulasi universal.',
    features: ['Universal Roblox Proxy', 'Task & Network Mock', 'Codegen AST Emitter'],
    suggestedAction: 'Gunakan Mimic V3 Sandbox untuk mengeksekusi VM dan merekonstruksi kode secara dinamis.',
  };
}
