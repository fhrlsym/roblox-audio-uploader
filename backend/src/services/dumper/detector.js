// Signature-based obfuscator detection. Mirrors the logic used by the web UI
// so the backend and the frontend always agree on what engine to run.

const ENGINES = {
  LURAPH: 'luraph-v14',
  PROMETHEUS: 'prometheus-ast',
  MOONVEIL: 'moonveil-devirt',
  IRONBREW: 'ironbrew-deobf',
  JUNKIE: 'mimic-sandbox',
  IRONVEIL: 'ironveil-deobf',
  BYTEARRAY: 'bytearray-unpacker',
  HTTPLOADER: 'httplog-interceptor',
  GENERIC: 'mimic-sandbox',
};

export function detectObfuscator(code) {
  const src = String(code || '').trim();

  if (!src) {
    return {
      engine: ENGINES.GENERIC,
      engineName: 'Universal Larry Dumper',
      obfuscator: 'Empty Script',
      version: null,
      confidence: 0,
      description: 'Tempelkan script Luau/Lua untuk memulai analisa otomatis.',
      features: [],
      suggestedAction: 'Tempel kode pada editor input.',
    };
  }

  // 1. Luraph (v11 - v14.7.2+)
  const isLuraph =
    /Luraph\s+Obfuscator/i.test(src) ||
    /https?:\/\/lura\.ph/i.test(src) ||
    /_LPH_SRC\s*=/i.test(src) ||
    (/LPH_/i.test(src) && /SCRIPT_KEY/i.test(src)) ||
    (src.includes('does your environment support') && src.includes('LPH_'));

  if (isLuraph) {
    const isV14 = /v14/i.test(src) || /_LPH_SRC/i.test(src) || /SCRIPT_KEY/i.test(src);
    return {
      engine: isV14 ? ENGINES.LURAPH : ENGINES.LURAPH,
      engineName: 'Luraph Dumper (Larry dumper.luau)',
      obfuscator: 'Luraph Obfuscator',
      version: isV14 ? 'v14.7.2+' : 'v11 - v13.x',
      confidence: 99,
      description: 'Ditemukan proteksi Luraph Obfuscator. Larry dumper.luau akan membongkar VM, melewati key system, dan menangkap seluruh string & remote call.',
      features: ['_LPH_SRC Hex Decoder', 'Key System Bypass', 'GC Proto Capture'],
      suggestedAction: 'Jalankan Luraph Dumper untuk membongkar source asli.',
    };
  }

  // 2. Prometheus / WeAreDevs
  const isWeAreDevs = /wearedevs\.net\/obfuscator/i.test(src) || /v1\.0\.0\s+https?:\/\/wearedevs/i.test(src);
  const isPrometheus =
    isWeAreDevs ||
    /Prometheus/i.test(src) ||
    /IllIIl|IIlllI|lIIlIl|IlIlIl/i.test(src) ||
    /ConstantArray/i.test(src) ||
    /ProxifyLocals/i.test(src) ||
    (/local\s+IllI/i.test(src) && src.includes('table.concat')) ||
    (/local\s+[a-zA-Z0-9_]+\s*=\s*\{["'\\]/i.test(src) && src.includes('ipairs') && src.includes('newproxy') && src.includes('getfenv'));

  if (isPrometheus) {
    return {
      engine: ENGINES.PROMETHEUS,
      engineName: 'Prometheus Deobfuscator (DeobfuscatorV2 + WAD trace)',
      obfuscator: isWeAreDevs ? 'Prometheus (WeAreDevs Web Wrapper)' : 'Prometheus Obfuscator',
      version: isWeAreDevs ? 'v1.0 (WeAreDevs)' : 'AST / VM Pipeline',
      confidence: 98,
      description: 'Ditemukan proteksi Prometheus/WeAreDevs. Prometheus-DeobfuscatorV2 me-rekonstruksi AST statis, lalu Prometheus-WAD menangkap trace eksekusi (string, print, call).',
      features: ['AST Reconstruction', 'Constant Array Decode', 'String Decrypt', 'Trace Emulation'],
      suggestedAction: 'Jalankan Prometheus Deobfuscator untuk merekonstruksi source asli.',
    };
  }

  // 3. Moonveil
  const isMoonveil =
    /Moonveil/i.test(src) ||
    /_MOONVEIL/i.test(src) ||
    (src.includes('moonveil') && src.includes('getgenv')) ||
    (src.length > 5000 && /bit32/i.test(src) && /local\s+[a-zA-Z0-9_]+\s*=\s*\{[0-9,\s]+\}/i.test(src));

  if (isMoonveil) {
    return {
      engine: ENGINES.MOONVEIL,
      engineName: 'Moonveil Devirtualizer (moonveil_decompile.py)',
      obfuscator: 'Moonveil Obfuscator',
      version: 'v1 - v2 Modern',
      confidence: 98,
      description: 'Ditemukan proteksi Moonveil. moonveil_decompile.py akan menganalisa interpreter, melepas register VM, lalu merekonstruksi source asli.',
      features: ['VM Register Lifter', 'Opcode Learning', 'AST Reconstruction'],
      suggestedAction: 'Jalankan Moonveil Devirtualizer untuk membongkar VM.',
    };
  }

  // 4. IronBrew 1 & 2
  const isIronBrew =
    /IronBrew/i.test(src) ||
    /ib2\s+fork/i.test(src) ||
    (src.includes('deserialize') && src.includes('bit32') && src.includes('string.sub')) ||
    (/local\s+function\s+[a-zA-Z0-9_]+\s*\([^)]*\)\s*local\s+[a-zA-Z0-9_]+\s*=\s*bit32\.bxor/i.test(src));

  if (isIronBrew) {
    return {
      engine: ENGINES.IRONBREW,
      engineName: 'IronBrew Deserializer (Larry dumper.luau)',
      obfuscator: 'IronBrew Obfuscator',
      version: /ib2/i.test(src) ? 'IB2 Fork' : 'IB1 Classic',
      confidence: 97,
      description: 'Ditemukan proteksi IronBrew dengan opcode deserializer. Larry dumper.luau dapat mendeteksi VM IronBrew dan menangkap string hasil dekripsi.',
      features: ['XOR String Capture', 'VM Detection', 'Loadstring Hook'],
      suggestedAction: 'Jalankan IronBrew Deserializer untuk menangkap string.',
    };
  }

  // 5. Junkie (base91)
  const isJunkie =
    /Protected\s+by\s+Junkie/i.test(src) ||
    /Junkie\s+[0-9.]+/i.test(src) ||
    (/\[=\[/.test(src) && src.includes(']=]') && /string\.byte/i.test(src));

  if (isJunkie) {
    return {
      engine: ENGINES.JUNKIE,
      engineName: 'Junkie Base91 Decoder (Larry dumper.luau)',
      obfuscator: 'Junkie Obfuscator',
      version: 'v1.0 - v2.0',
      confidence: 96,
      description: 'Ditemukan proteksi Junkie. Larry dumper.luau otomatis mendekode payload base91 saat script berjalan.',
      features: ['Base91 Decoder', 'String Capture'],
      suggestedAction: 'Jalankan Junkie Decoder untuk membongkar payload base91.',
    };
  }

  // 6. IronVeil (older-style, signature comment from its obfuscator)
  const isIronVeil = /Obfuscated using ironveil/i.test(src);

  if (isIronVeil) {
    return {
      engine: ENGINES.IRONVEIL,
      engineName: 'IronVeil Deobfuscator (ironveil-deobf)',
      obfuscator: 'IronVeil Obfuscator',
      version: 'v1',
      confidence: 95,
      description: 'Ditemukan proteksi IronVeil. IronVeil-deobf (Node.js) membongkar payload berantai base64 → xor → LZW → IR → Lua secara statis.',
      features: ['Payload Unpack', 'XOR Decrypt', 'LZW Decompress', 'IR to Lua'],
      suggestedAction: 'Jalankan IronVeil Deobfuscator untuk merekonstruksi source asli.',
    };
  }

  // 7. Byte array / char array
  const isByteArray =
    (/string\.char\s*\(\s*[0-9\s,]+\s*\)/i.test(src) && src.length > 500) ||
    /loadstring\s*\(\s*table\.concat/i.test(src) ||
    /loadstring\s*\(\s*string\.char/i.test(src);

  if (isByteArray) {
    return {
      engine: ENGINES.BYTEARRAY,
      engineName: 'Byte Array & Char Unpacker',
      obfuscator: 'Bytecode / Char Array Obfuscator',
      version: 'Simple Encoded',
      confidence: 94,
      description: 'Ditemukan script terenkripsi memakai kumpulan angka byte (string.char). Akan didecode langsung tanpa menjalankan script.',
      features: ['Byte Decoder', 'Char Array Evaluator', 'Loadstring Unpacker'],
      suggestedAction: 'Jalankan Byte Array Unpacker untuk mengubah angka byte menjadi kode teks.',
    };
  }

  // 7. External loader / webhook
  const isExternalLoader =
    /game\s*:\s*HttpGet/i.test(src) ||
    /syn\.request/i.test(src) ||
    /http_request/i.test(src) ||
    /request\s*\(\s*\{/i.test(src) ||
    /discord\.com\/api\/webhooks/i.test(src);

  if (isExternalLoader) {
    return {
      engine: ENGINES.HTTPLOADER,
      engineName: 'HTTP & Webhook Scanner',
      obfuscator: 'External Loader / Script Hub',
      version: 'Network Hub',
      confidence: 92,
      description: 'Ditemukan script loader yang memanggil resource eksternal atau mengirim log webhook.',
      features: ['URL Scanner', 'Webhook Detector'],
      suggestedAction: 'Jalankan HTTP Scanner untuk menangkap link script rahasia dan payload.',
    };
  }

  // 8. Unknown / generic -> universal dumper
  return {
    engine: ENGINES.GENERIC,
    engineName: 'Universal Larry Dumper',
    obfuscator: 'Generic / Custom Luau Obfuscator',
    version: 'Universal VM',
    confidence: 80,
    description: 'Signature spesifik tidak ditemukan. Larry dumper.luau akan dijalankan secara universal untuk menangkap string, remote, dan global assignment.',
    features: ['Universal Roblox Proxy', 'String Capture', 'Global Tracker'],
    suggestedAction: 'Jalankan Universal Dumper untuk menangkap seluruh string dan pemanggilan remote.',
  };
}

export function engineToDisplayName(engine) {
  const names = {
    'luraph-v14': 'Luraph Dumper',
    'prometheus-ast': 'Prometheus Deobfuscator',
    'moonveil-devirt': 'Moonveil Devirtualizer',
    'ironbrew-deobf': 'IronBrew Deserializer',
    'mimic-sandbox': 'Universal Larry Dumper',
    'ironveil-deobf': 'IronVeil Deobfuscator',
    'bytearray-unpacker': 'Byte Array Unpacker',
    'httplog-interceptor': 'HTTP Scanner',
  };
  return names[engine] || 'Universal Larry Dumper';
}
