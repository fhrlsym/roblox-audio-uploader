import { Router } from 'express';
import { detectObfuscator } from '../services/dumper/detector.js';
import { runDump, availableBinaries } from '../services/dumper/engine-runner.js';

const router = Router();

// GET /api/dumper/status -> what proven engines are available on this server
router.get('/dumper/status', (req, res) => {
  const bins = availableBinaries();
  res.json({
    success: true,
    binaries: bins,
    engines: {
      larry: !!bins.lune,
      '45ms': !!bins.lune,
      unveilr: !!bins.lune,
      ironveil: !!bins.node,
      moonveil: !!bins.python3 && !!bins.luau,
      'prometheus-deobf': !!bins.lua51,
      'prometheus-wad': !!bins.python3 && !!bins.lua51,
      static: true,
    },
  });
});

// POST /api/dumper/detect
router.post('/dumper/detect', (req, res) => {
  try {
    const code = String(req.body?.code || '');
    const detection = detectObfuscator(code);
    res.json({ success: true, detection });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Gagal mendeteksi script' });
  }
});

// POST /api/dumper/run
router.post('/dumper/run', async (req, res) => {
  try {
    const code = String(req.body?.code || '');
    const engine = String(req.body?.engine || 'auto');
    const result = await runDump({ code, engine });
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Gagal mengeksekusi dumper' });
  }
});

export default router;