import { Router } from 'express';
import {
  fetchGitHubMaps,
  fetchGitHubGenres,
  commitSongsToGitHub,
  sanitizeMapFilename,
} from '../services/github.service.js';

const router = Router();

// GET /api/github/maps
router.get('/github/maps', async (req, res) => {
  try {
    const maps = await fetchGitHubMaps();
    res.json({ success: true, maps });
  } catch (error) {
    console.error('Error fetching GitHub maps:', error);
    res.status(500).json({ error: error.message || 'Gagal memuat daftar map dari GitHub' });
  }
});

// GET /api/github/genres?mapFile=musicsbjoi.json
router.get('/github/genres', async (req, res) => {
  const mapFile = String(req.query.mapFile || '').trim();
  if (!mapFile) {
    return res.status(400).json({ error: 'Parameter mapFile diperlukan' });
  }

  try {
    const genres = await fetchGitHubGenres(mapFile);
    res.json({ success: true, genres });
  } catch (error) {
    console.error('Error fetching GitHub genres:', error);
    res.status(500).json({ error: error.message || 'Gagal memuat daftar genre dari GitHub' });
  }
});

// POST /api/github/commit
router.post('/github/commit', async (req, res) => {
  const { mapFilename, genre, songs, isNewMap, newMapName, coverAssetId } = req.body;

  let targetFilename = mapFilename;
  if (isNewMap) {
    targetFilename = sanitizeMapFilename(newMapName);
  }

  if (!targetFilename) {
    return res.status(400).json({ error: 'Nama map tujuan tidak boleh kosong' });
  }

  if (!genre || !String(genre).trim()) {
    return res.status(400).json({ error: 'Nama genre tidak boleh kosong' });
  }

  if (!Array.isArray(songs) || songs.length === 0) {
    return res.status(400).json({ error: 'Pilih minimal 1 lagu untuk di-sync' });
  }

  try {
    const result = await commitSongsToGitHub({
      mapFilename: targetFilename,
      genre,
      songs,
      coverAssetId,
    });
    res.json(result);
  } catch (error) {
    console.error('Error committing to GitHub:', error);
    res.status(500).json({ error: error.message || 'Gagal commit ke repository GitHub' });
  }
});

export default router;
