import { DetectionResult } from './types';

export function detectObfuscator(code: string): DetectionResult {
  const src = String(code || '').trim();

  if (!src) {
    return {
      engine: 'mimic-sandbox',
      engineName: 'Universal Larry Dumper',
      obfuscator: 'Empty Script',
      confidence: 0,
      description: 'Tempelkan script Luau/Lua untuk memulai analisa signature otomatis.',
      features: [],
      suggestedAction: 'Paste kode Anda pada editor input.',
    };
  }

  // 1. Luraph Obfuscator (v11, v12, v13, v14.0 - v14.7.2+)
  const isLuraph =
    /Luraph\s+Obfuscator/i.test(src) ||
    /https?:\/\/lura\.ph/i.test(src) ||
    /_LPH_SRC\s*=/i.test(src) ||
    (/LPH_/i.test(src) && /SCRIPT_KEY/i.test(src)) ||
    (src.includes('does your environment support') && src.includes('LPH_')) ||
    (/return\s*\(\s*\{\s*E\s*=\s*function/i.test(src) && /lura\.ph/i.test(src));

  if (isLuraph) {
    const isV14 = /v14/i.test(src) || /_LPH_SRC/i.test(src) || /SCRIPT_KEY/i.test(src);
    return {
      engine: isV14 ? 'luraph-v14' : 'luraph-25ms',
      engineName: isV14 ? 'Luraph Dumper (Larry dumper.luau)' : 'Luraph Dumper (Larry dumper.luau)',
      obfuscator: 'Luraph Obfuscator',
      version: isV14 ? 'v14.7.2+' : 'v11 - v13.x',
      confidence: 99,
      description: 'Terdeteksi proteksi Luraph Obfuscator dengan VM register dispatch, constant hashing, dan GC proto trees.',
      features: ['LPH_ Token Header', 'GC Proto Extraction', 'Hex Bytecode Stream', 'Bitwise Unwrapper'],
      suggestedAction: 'Gunakan engine Luraph v14 Proto Dumper untuk mengekstrak proto functions dan seluruh string pool.',
    };
  }

  // 2. Prometheus / WeAreDevs Obfuscator Pipeline (WeAreDevs is a wrapper of Prometheus)
  const isWeAreDevs =
    /wearedevs\.net\/obfuscator/i.test(src) ||
    /v1\.0\.0\s+https?:\/\/wearedevs/i.test(src);

  const isPrometheus =
    isWeAreDevs ||
    /Prometheus/i.test(src) ||
    /IllIIl|IIlllI|lIIlIl|IlIlIl/i.test(src) ||
    /ConstantArray/i.test(src) ||
    /ProxifyLocals/i.test(src) ||
    /NumbersToExpressions/i.test(src) ||
    (/local\s+IllI/i.test(src) && src.includes('table.concat')) ||
    (/local\s+[a-zA-Z0-9_]+\s*=\s*\{["'\\]/i.test(src) && src.includes('ipairs') && src.includes('newproxy') && src.includes('getfenv'));

  if (isPrometheus) {
    const variantName = isWeAreDevs ? 'Prometheus (WeAreDevs Web Wrapper)' : 'Prometheus Obfuscator';
    return {
      engine: 'prometheus-ast',
      engineName: 'Prometheus / WeAreDevs Unpacker (Larry dumper.luau)',
      obfuscator: variantName,
      version: isWeAreDevs ? 'v1.0 (WeAreDevs)' : 'AST / VM Pipeline',
      confidence: 98,
      description: isWeAreDevs
        ? 'Terdeteksi script proteksi Prometheus Obfuscator (didistribusikan melalui wrapper WeAreDevs) dengan cipher Base64 dan VM dispatcher.'
        : 'Terdeteksi script proteksi Prometheus Obfuscator dengan manipulasi AST, ConstantArray solver, dan permutation dispatcher.',
      features: ['Permutation Array Unpacker', 'Base64 Table Decrypter', 'ConstantArray Solver', 'Scope Unfolder'],
      suggestedAction: 'Gunakan Prometheus AST & VM Unpacker untuk membongkar tabel konstanta dan merekonstruksi kode Luau asli.',
    };
  }

  // 3. Moonveil Obfuscator (v1 - v2 Modern)
  const isMoonveil =
    /Moonveil/i.test(src) ||
    /_MOONVEIL/i.test(src) ||
    (src.includes('moonveil') && src.includes('getgenv')) ||
    (/return\s*\(\s*\{\s*E\s*=\s*function\s*\([a-z,\s]+\)[a-z0-9_\[\]=;\s]+if/i.test(src) && !/lura\.ph/i.test(src)) ||
    (/local\s+[a-zA-Z0-9_]+\s*=\s*\{[0-9,\s]+\}\s*;?\s*local\s+[a-zA-Z0-9_]+\s*=\s*getfenv/i.test(src) && src.length > 5000 && /bit32/i.test(src));

  if (isMoonveil) {
    return {
      engine: 'moonveil-devirt',
      engineName: 'Moonveil Devirtualizer (moonveil_decompile.py)',
      obfuscator: 'Moonveil Obfuscator',
      version: 'v2 / Modern',
      confidence: 98,
      description: 'Terdeteksi proteksi Moonveil dengan virtual register stack dan control flow flattening.',
      features: ['VM Register Lifter', 'Trace Reconstructor', 'AST Control Flow Unfolder'],
      suggestedAction: 'Gunakan Moonveil Devirtualizer untuk mengangkat register VM menjadi Luau AST asli.',
    };
  }

  // 4. IronBrew 1 & 2 (and 25ms IB forks)
  const isIronBrew =
    /IronBrew/i.test(src) ||
    /ib2\s+fork/i.test(src) ||
    /discord\.gg\/25ms.*obfuscation:\s*ib/i.test(src) ||
    (/table,\s*string,\s*bit/i.test(src) && /string\.sub/i.test(src) && /deserialize/i.test(src)) ||
    (/local\s+function\s+[a-zA-Z0-9_]+\s*\([^)]*\)\s*local\s+[a-zA-Z0-9_]+\s*=\s*bit32\.bxor/i.test(src) && src.includes('\\x')) ||
    (src.includes('deserialize') && src.includes('bit32') && src.includes('string.sub'));

  if (isIronBrew) {
    const isIb2 = /ib2/i.test(src) || src.includes('table,string,bit');
    return {
      engine: 'ironbrew-deobf',
      engineName: 'IronBrew Deserializer (Larry dumper.luau)',
      obfuscator: 'IronBrew Obfuscator',
      version: isIb2 ? 'IB2 Fork' : 'IB1 Classic',
      confidence: 97,
      description: 'Terdeteksi proteksi IronBrew dengan opcode deserializer dan enkripsi string XOR multi-tahap.',
      features: ['Opcode Table Decompiler', 'XOR String Unpacker', 'Bytecode Slicer'],
      suggestedAction: 'Gunakan IronBrew Deobfuscator untuk mengekstrak instruksi VM dan string pool.',
    };
  }

  // 5. Junkie Obfuscator (v1.0 - v2.0)
  const isJunkie =
    /Protected\s+by\s+Junkie/i.test(src) ||
    /Junkie\s+[0-9.]+/i.test(src) ||
    (/local\s+[a-zA-Z0-9_]+\s*=\s*\{\s*\[=\[/i.test(src) && src.includes(']=]') && /string\.byte/i.test(src));

  if (isJunkie) {
    return {
      engine: 'mimic-sandbox',
      engineName: 'Universal Larry Dumper',
      obfuscator: 'Junkie Obfuscator',
      version: 'v1.0 - v2.0',
      confidence: 96,
      description: 'Terdeteksi proteksi Junkie Obfuscator dengan encoded multi-line string block dan dynamic char mapper.',
      features: ['Raw Block Decoder', 'Dynamic Charset Unpacker', 'Universal Sandbox Emulator'],
      suggestedAction: 'Gunakan Mimic V3 Universal Sandbox untuk membongkar string block Junkie.',
    };
  }

  // 6. IronVeil Obfuscator (v1)
  const isIronVeil = /Obfuscated using ironveil/i.test(src);

  if (isIronVeil) {
    return {
      engine: 'ironveil-deobf',
      engineName: 'IronVeil Deobfuscator (ironveil-deobf)',
      obfuscator: 'IronVeil Obfuscator',
      version: 'v1',
      confidence: 95,
      description: 'Terdeteksi proteksi IronVeil. IronVeil-deobf (Node.js) membongkar payload berantai base64 → xor → LZW → IR → Lua secara statis.',
      features: ['Payload Unpack', 'XOR Decrypt', 'LZW Decompress', 'IR to Lua'],
      suggestedAction: 'Jalankan IronVeil Deobfuscator untuk merekonstruksi source asli.',
    };
  }

  // 7. Byte Array / String.char Array / Numeric Bytecode
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
      confidence: 94,
      description: 'Terdeteksi script terenkripsi menggunakan kumpulan karakter numerik (string.char / byte tables).',
      features: ['Instant Byte Decoder', 'Char Array Evaluator', 'Loadstring Unpacker'],
      suggestedAction: 'Gunakan Byte Array Unpacker untuk langsung mengonversi angka byte menjadi kode teks.',
    };
  }

  // 7. External Loader & HTTP Interceptor
  const isExternalLoader =
    /game\s*:\s*HttpGet/i.test(src) ||
    /syn\.request/i.test(src) ||
    /http_request/i.test(src) ||
    /request\s*\(\s*\{/i.test(src) ||
    /discord\.com\/api\/webhooks/i.test(src);

  if (isExternalLoader) {
    return {
      engine: 'httplog-interceptor',
      engineName: 'HTTP & Webhook Scanner',
      obfuscator: 'External Loader / Script Hub',
      version: 'Network Hub',
      confidence: 92,
      description: 'Terdeteksi script loader yang memanggil resource eksternal atau mengirim log webhook.',
      features: ['HttpGet Sniffer', 'Webhook URL Extractor', 'Raw Script Auto-Fetcher'],
      suggestedAction: 'Gunakan 25ms HTTP Interceptor untuk menangkap link script rahasia dan payload.',
    };
  }

  // 8. Revea / Environment Hooks
  const isEnvLoggerTarget =
    /getgenv\(\)/i.test(src) ||
    /getrenv\(\)/i.test(src) ||
    /hookmetamethod/i.test(src) ||
    /hookfunction/i.test(src) ||
    /getrawmetatable/i.test(src);

  if (isEnvLoggerTarget) {
    return {
      engine: 'revea-env',
      engineName: 'Environment Scanner',
      obfuscator: 'Environment Hooking Script',
      version: 'Memory Hooks',
      confidence: 88,
      description: 'Terdeteksi script yang memodifikasi metatable, hook metamethod, atau environment global.',
      features: ['Global Hook Logger', 'Metamethod Trapper', 'Closure Inspector'],
      suggestedAction: 'Gunakan Revea Memory Dumper untuk mencatat modifikasi environment global.',
    };
  }

  // 9. Generic / Unknown Luau VM (Fallback to Mimic V3 Universal)
  return {
    engine: 'mimic-sandbox',
    engineName: 'Universal Larry Dumper',
    obfuscator: 'Generic / Custom Luau Obfuscator',
    version: 'Universal VM',
    confidence: 80,
    description: 'Format script tidak terdaftar pada signature spesifik, menggunakan sandbox emulasi universal.',
    features: ['Universal Roblox Proxy', 'Task & Network Mock', 'Codegen AST Emitter'],
    suggestedAction: 'Gunakan Mimic V3 Sandbox untuk mengeksekusi VM dan merekonstruksi kode secara dinamis.',
  };
}
