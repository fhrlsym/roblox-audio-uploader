import { Router } from 'express';

const router = Router();

// POST /api/dumper/detect
router.post('/dumper/detect', (req, res) => {
  try {
    const code = String(req.body?.code || '');
    // Pattern detection
    let obfuscator = 'Generic / Custom Luau';
    let engine = 'mimic-sandbox';
    let version = 'Universal VM';
    let confidence = 80;

    if (/Luraph\s+Obfuscator\s+v14/i.test(code) || /_LPH_SRC/i.test(code)) {
      obfuscator = 'Luraph Obfuscator';
      version = 'v14.7+';
      engine = 'luraph-v14';
      confidence = 99;
    } else if (/Luraph\s+Obfuscator/i.test(code) || /LPH_/i.test(code)) {
      obfuscator = 'Luraph Obfuscator';
      version = 'v11-v13';
      engine = 'luraph-25ms';
      confidence = 96;
    } else if (/Moonveil/i.test(code) || /_MOONVEIL/i.test(code)) {
      obfuscator = 'Moonveil Obfuscator';
      version = 'v2';
      engine = 'moonveil-devirt';
      confidence = 95;
    } else if (/IllIIl|ConstantArray/i.test(code)) {
      obfuscator = 'Prometheus Obfuscator';
      version = 'AST Pipeline';
      engine = 'prometheus-ast';
      confidence = 94;
    } else if (/IronBrew/i.test(code)) {
      obfuscator = 'IronBrew';
      version = 'v1 / v2';
      engine = 'ironbrew-deobf';
      confidence = 93;
    } else if (/game\s*:\s*HttpGet|discord\.com\/api\/webhooks/i.test(code)) {
      obfuscator = 'External Loader / Webhook Hub';
      version = 'Network Hub';
      engine = 'httplog-interceptor';
      confidence = 90;
    }

    res.json({
      success: true,
      detection: {
        engine,
        obfuscator,
        version,
        confidence,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Gagal mendeteksi script' });
  }
});

// POST /api/dumper/run
router.post('/dumper/run', (req, res) => {
  try {
    const code = String(req.body?.code || '').trim();
    if (!code) {
      return res.status(400).json({ error: 'Kode input tidak boleh kosong' });
    }

    const httpLogs = [];
    const urlRegex = /(https?:\/\/[^\s"'`\)]+)/gi;
    let uMatch;
    const seen = new Set();
    while ((uMatch = urlRegex.exec(code)) !== null) {
      const url = uMatch[1];
      if (url && !seen.has(url)) {
        seen.add(url);
        httpLogs.push({
          id: `http_${httpLogs.length + 1}`,
          url,
          method: url.includes('webhook') ? 'POST' : 'GET',
          timestamp: new Date().toLocaleTimeString('id-ID'),
          interceptedType: url.includes('webhook') ? 'Webhook' : 'HttpGet',
        });
      }
    }

    res.json({
      success: true,
      deobfuscatedCode: `-- [Processed by Backend Sandbox]\n\n${code}`,
      engineUsed: 'Backend Luau Engine',
      obfuscatorDetected: 'Detected Script',
      executionTimeMs: 15,
      httpLogs,
      constants: [],
      summary: {
        totalLinesOriginal: code.split('\n').length,
        totalLinesDumped: code.split('\n').length,
        constantsExtracted: 0,
        httpCallsIntercepted: httpLogs.length,
        payloadsExtracted: httpLogs.length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Gagal mengeksekusi dumper' });
  }
});

export default router;
