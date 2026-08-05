import ffmpeg from 'fluent-ffmpeg';
import { execFile } from 'child_process';

export async function generateSilentMp3(outputPath, durationSeconds = 1) {
  const ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg';
  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-t', String(durationSeconds),
    '-b:a', '96k',
    '-codec:a', 'libmp3lame',
    '-ar', '44100',
    '-map_metadata', '-1',
    outputPath,
  ];
  return new Promise((resolve, reject) => {
    execFile(ffmpegBin, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`FFmpeg silent mp3 gagal: ${(stderr || err.message).trim()}`));
      } else {
        resolve();
      }
    });
  });
}

export async function runFFmpeg(inputPath, outputPath, speed = 1.0, amplify = 0) {
  return new Promise((resolve, reject) => {
    const filters = [];

    if (parseFloat(amplify) !== 0) {
      filters.push(`volume=${amplify}dB`);
    }

    console.log('[FFmpeg] Filters:', filters.join(',') || 'none (format conversion only)');

    let command = ffmpeg(inputPath);
    if (filters.length > 0) {
      command = command.audioFilters(filters);
    }

    command
      .audioBitrate(256)
      .audioCodec('libmp3lame')
      .audioFrequency(48000)
      .toFormat('mp3')
      .outputOptions('-map_metadata', '-1')
      .on('start', (cmd) => console.log('[FFmpeg] Command:', cmd))
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
}
