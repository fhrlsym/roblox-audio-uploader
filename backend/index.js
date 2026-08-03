import express from 'express';
import cors from 'cors';
import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import { createWriteStream, createReadStream, unlinkSync, existsSync } from 'fs';
import { pipeline } from 'stream/promises';
import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

app.post('/api/youtube-download', async (req, res) => {
  const { url, speed = 1.0, amplify = 0 } = req.body;

  if (!url || !ytdl.validateURL(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  const videoId = ytdl.getVideoID(url);
  const tempAudioPath = join(__dirname, `temp_${videoId}.mp3`);
  const outputPath = join(__dirname, `output_${videoId}.mp3`);

  try {
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s-]/g, '').substring(0, 50);

    const audioStream = ytdl(url, {
      quality: 'highestaudio',
      filter: 'audioonly',
    });

    const writeStream = createWriteStream(tempAudioPath);
    await pipeline(audioStream, writeStream);

    const needsProcessing = speed !== 1.0 || amplify !== 0;

    if (needsProcessing) {
      await new Promise((resolve, reject) => {
        let command = ffmpeg(tempAudioPath);

        const filters = [];
        if (speed !== 1.0) {
          filters.push(`atempo=${speed}`);
        }
        if (amplify !== 0) {
          filters.push(`volume=${amplify}dB`);
        }

        if (filters.length > 0) {
          command = command.audioFilters(filters);
        }

        command
          .audioBitrate(128)
          .audioCodec('libmp3lame')
          .toFormat('mp3')
          .on('end', resolve)
          .on('error', reject)
          .save(outputPath);
      });

      if (existsSync(tempAudioPath)) unlinkSync(tempAudioPath);
    } else {
      if (existsSync(outputPath)) unlinkSync(outputPath);
      createReadStream(tempAudioPath).pipe(createWriteStream(outputPath));
      if (existsSync(tempAudioPath)) unlinkSync(tempAudioPath);
    }

    res.json({
      success: true,
      filename: `${title}.mp3`,
      path: outputPath,
      fileId: `output_${videoId}`,
    });

  } catch (error) {
    console.error('Download error:', error);
    if (existsSync(tempAudioPath)) unlinkSync(tempAudioPath);
    if (existsSync(outputPath)) unlinkSync(outputPath);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/download-file/:fileId', (req, res) => {
  const filePath = join(__dirname, `${req.params.fileId}.mp3`);
  
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, (err) => {
    if (err) {
      console.error('Download error:', err);
    }
    if (existsSync(filePath)) {
      setTimeout(() => {
        try {
          unlinkSync(filePath);
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      }, 5000);
    }
  });
});

app.post('/api/process-audio', upload.single('file'), async (req, res) => {
  const { speed = 1.0, amplify = 0 } = req.body;
  const inputPath = req.file.path;
  const outputPath = `${inputPath}_processed.mp3`;

  try {
    await new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      const filters = [];
      if (parseFloat(speed) !== 1.0) {
        filters.push(`atempo=${speed}`);
      }
      if (parseFloat(amplify) !== 0) {
        filters.push(`volume=${amplify}dB`);
      }

      if (filters.length > 0) {
        command = command.audioFilters(filters);
      }

      command
        .audioBitrate(128)
        .audioCodec('libmp3lame')
        .toFormat('mp3')
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });

    const processedFile = createReadStream(outputPath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${req.file.originalname}"`);
    
    processedFile.pipe(res);

    processedFile.on('end', () => {
      setTimeout(() => {
        if (existsSync(inputPath)) unlinkSync(inputPath);
        if (existsSync(outputPath)) unlinkSync(outputPath);
      }, 1000);
    });

  } catch (error) {
    console.error('Processing error:', error);
    if (existsSync(inputPath)) unlinkSync(inputPath);
    if (existsSync(outputPath)) unlinkSync(outputPath);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
