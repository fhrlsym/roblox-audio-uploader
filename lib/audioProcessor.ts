// Client-side audio processing dengan tempo stretching (preserve pitch seperti REZZZ)
import * as Tone from 'tone';

declare const lamejs: any;

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

// Simple phase vocoder for time stretching (preserve pitch)
function timeStretch(buffer: AudioBuffer, rate: number): AudioBuffer {
  if (rate === 1.0) return buffer;
  
  const targetRate = 48000;
  const channels = buffer.numberOfChannels;
  const newLength = Math.floor(buffer.length / rate);
  const newBuffer = new AudioContext({ sampleRate: targetRate }).createBuffer(channels, newLength, targetRate);
  
  // Simple overlap-add with grain size
  const grainSize = 4096;
  const hopSize = Math.floor(grainSize / rate);
  
  for (let ch = 0; ch < channels; ch++) {
    const inputData = buffer.getChannelData(ch);
    const outputData = newBuffer.getChannelData(ch);
    
    // Hanning window
    const window = new Float32Array(grainSize);
    for (let i = 0; i < grainSize; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (grainSize - 1)));
    }
    
    let outputPos = 0;
    let inputPos = 0;
    
    while (outputPos < newLength && inputPos < inputData.length - grainSize) {
      // Copy grain with window
      for (let i = 0; i < grainSize && outputPos + i < outputData.length; i++) {
        const inIdx = Math.floor(inputPos + i);
        if (inIdx < inputData.length) {
          outputData[outputPos + i] += inputData[inIdx] * window[i];
        }
      }
      
      outputPos += hopSize;
      inputPos += grainSize;
    }
    
    // Normalize
    let maxVal = 0;
    for (let i = 0; i < outputData.length; i++) {
      maxVal = Math.max(maxVal, Math.abs(outputData[i]));
    }
    if (maxVal > 0) {
      for (let i = 0; i < outputData.length; i++) {
        outputData[i] /= maxVal;
      }
    }
  }
  
  return newBuffer;
}

function bufferToMp3(buffer: AudioBuffer): Blob {
  const ch = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const enc = new lamejs.Mp3Encoder(ch, rate, 320);
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
  
  // TIME STRETCH dengan preserve pitch (seperti REZZZ atempo)
  const stretched = timeStretch(srcBuf, speedVal);
  onProgress?.(60);
  
  // Apply gain + filters ke hasil stretch
  const targetRate = 48000;
  const frames = stretched.length;
  const offline = new OfflineAudioContext(stretched.numberOfChannels, frames, targetRate);
  
  const source = offline.createBufferSource();
  source.buffer = stretched;
  
  const gain = offline.createGain();
  gain.gain.value = Math.pow(10, dbVal / 20);
  
  // Mild presence boost
  const peak = offline.createBiquadFilter();
  peak.type = 'peaking';
  peak.frequency.value = 2800;
  peak.Q.value = 0.7;
  peak.gain.value = 0.8;
  
  // Anti-alias filter
  const lp = offline.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(20000, targetRate * 0.45);
  lp.Q.value = 0.707;
  
  source.connect(peak);
  peak.connect(gain);
  gain.connect(lp);
  lp.connect(offline.destination);
  
  source.start(0);
  let rendered = await offline.startRendering();
  onProgress?.(80);
  
  rendered = softLimit(rendered, 0.92);
  
  try { await ctx.close(); } catch (_) {}
  
  onProgress?.(90);
  const mp3Blob = bufferToMp3(rendered);
  onProgress?.(100);
  
  return mp3Blob;
}
