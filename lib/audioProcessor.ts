// Client-side audio processing dengan lamejs (seperti REZZZ AUDIO)
import lamejs from 'lamejs';

function floatTo16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    let s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return out;
}

function softLimit(buffer: AudioBuffer, threshold = 0.92): AudioBuffer {
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const x = data[i];
      const ax = Math.abs(x);
      if (ax > threshold) {
        data[i] = Math.sign(x) * (threshold + (1 - threshold) * Math.tanh((ax - threshold) / (1 - threshold + 1e-6)));
      }
    }
  }
  return buffer;
}

function bufferToMp3(buffer: AudioBuffer): Blob {
  const ch = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const enc = new lamejs.Mp3Encoder(ch, rate, 256);
  const left = floatTo16(buffer.getChannelData(0));
  const right = ch > 1 ? floatTo16(buffer.getChannelData(1)) : left;
  const blocks: Uint8Array[] = [];
  const size = 1152;
  
  for (let i = 0; i < left.length; i += size) {
    const l = left.subarray(i, i + size);
    const r = right.subarray(i, i + size);
    const buf = ch === 1 ? enc.encodeBuffer(l) : enc.encodeBuffer(l, r);
    if (buf.length) blocks.push(buf);
  }
  
  const end = enc.flush();
  if (end.length) blocks.push(end);
  
  return new Blob(blocks as BlobPart[], { type: 'audio/mp3' });
}

export async function processAudio(
  file: File,
  speedVal: number,
  dbVal: number,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  onProgress?.(10);
  
  const ab = await file.arrayBuffer();
  onProgress?.(20);
  
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let srcBuf = await ctx.decodeAudioData(ab);
  onProgress?.(40);
  
  // Pakai sample rate asli seperti REZZZ AUDIO
  const targetRate = srcBuf.sampleRate;
  const duration = srcBuf.duration / speedVal;
  const frames = Math.max(1, Math.ceil(duration * targetRate));
  const offline = new OfflineAudioContext(srcBuf.numberOfChannels, frames, targetRate);
  
  const source = offline.createBufferSource();
  source.buffer = srcBuf;
  source.playbackRate.value = speedVal;
  
  const gain = offline.createGain();
  gain.gain.value = Math.pow(10, dbVal / 20);
  
  // Mild presence boost
  const peak = offline.createBiquadFilter();
  peak.type = 'peaking';
  peak.frequency.value = 2800;
  peak.Q.value = 0.7;
  peak.gain.value = 0.8;
  
  // Anti-alias filter untuk speed tinggi
  const lp = offline.createBiquadFilter();
  lp.type = 'lowpass';
  const nyquist = targetRate * 0.5;
  const cut = Math.min(nyquist * 0.92, Math.max(12000, nyquist / Math.max(1, speedVal * 0.55)));
  lp.frequency.value = cut;
  lp.Q.value = 0.707;
  
  source.connect(peak);
  peak.connect(gain);
  gain.connect(lp);
  lp.connect(offline.destination);
  
  source.start(0);
  onProgress?.(60);
  
  let rendered = await offline.startRendering();
  onProgress?.(80);
  
  rendered = softLimit(rendered, 0.92);
  
  try { await ctx.close(); } catch (_) {}
  
  onProgress?.(90);
  const mp3Blob = bufferToMp3(rendered);
  onProgress?.(100);
  
  return mp3Blob;
}
