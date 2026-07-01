/**
 * Generates tiny WAV sound effects for the app.
 * Run: node scripts/generate-sounds.js
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 8000;

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function generateWAV(samples, sampleRate) {
  const numSamples = samples.length;
  const dataSize = numSamples;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  writeString(v, 0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  writeString(v, 8, 'WAVE');
  writeString(v, 12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  writeString(v, 36, 'data');
  v.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) {
    v.setUint8(44 + i, Math.max(0, Math.min(255, Math.round(samples[i] + 128))));
  }
  return Buffer.from(buf);
}

function envelope(i, total, attack = 0.05, release = 0.1) {
  if (i / total < attack) return (i / total) / attack;
  if (i / total > 1 - release) return (1 - i / total) / release;
  return 1;
}

function generateTap() {
  const duration = 0.05;
  const n = Math.round(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(i, n, 0.02, 0.3);
    samples[i] = Math.sin(2 * Math.PI * 1200 * t) * env * 0.6;
  }
  return generateWAV(samples, SAMPLE_RATE);
}

function generateSuccess() {
  const duration = 0.3;
  const n = Math.round(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(i, n, 0.02, 0.15);
    const freq = 523 + (1047 - 523) * (t / duration);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.5;
  }
  return generateWAV(samples, SAMPLE_RATE);
}

function generateError() {
  const duration = 0.35;
  const n = Math.round(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(i, n, 0.02, 0.2);
    const freq = 300 - 150 * (t / duration);
    samples[i] = (Math.sin(2 * Math.PI * freq * t) + Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.5) * env * 0.4;
  }
  return generateWAV(samples, SAMPLE_RATE);
}

function generateWhoosh() {
  const duration = 0.15;
  const n = Math.round(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(i, n, 0.01, 0.2);
    const noise = Math.random() * 2 - 1;
    const freq = 600 + 2400 * (t / duration);
    const tone = Math.sin(2 * Math.PI * freq * t);
    samples[i] = (tone * 0.4 + noise * 0.3) * env * 0.3;
  }
  return generateWAV(samples, SAMPLE_RATE);
}

function generateRefresh() {
  const duration = 0.2;
  const n = Math.round(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(i, n, 0.02, 0.15);
    const freq = 400 + 1000 * Math.pow(t / duration, 0.5);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.4;
  }
  return generateWAV(samples, SAMPLE_RATE);
}

const outDir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });

const sounds = {
  'tap.wav': generateTap(),
  'success.wav': generateSuccess(),
  'error.wav': generateError(),
  'whoosh.wav': generateWhoosh(),
  'refresh.wav': generateRefresh(),
};

for (const [name, data] of Object.entries(sounds)) {
  const filePath = path.join(outDir, name);
  fs.writeFileSync(filePath, data);
  const size = fs.statSync(filePath).size;
  console.log(`✓ ${name} (${size} bytes)`);
}

console.log('\nSound files generated in assets/sounds/');
