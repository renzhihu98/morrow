#!/usr/bin/env node
/**
 * Generates assets/grain.png — the tileable paper-grain overlay (SPEC §4.C).
 *
 * Reproduces the web filter
 *   <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
 *   <feColorMatrix type="saturate" values="0"/>
 * drawn over black with `mix-blend-mode: multiply; opacity: .08`.
 *
 * Multiply at opacity o darkens the page by o · A · (1 − L), where A is the noise alpha and
 * L its desaturated luminance. React Native has no blend modes, but a black layer with alpha
 * a darkens by exactly a, so we bake d = A · (1 − L) into the alpha of a black PNG
 * (normalised by dMax for 8-bit precision). Render it at opacity 0.08 · dMax (printed below)
 * for the same result as the web grain.
 *
 * Usage: node scripts/make-grain.mjs   (only Node built-ins)
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZE = 256;
const BASE_FREQUENCY = 0.85;
const OCTAVES = 2;

// Deterministic PRNG (mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Periodic 2D Perlin gradient noise with an integer lattice period (stitched tiles). */
function makePerlin(seed, period) {
  const rand = rng(seed);
  const gx = new Float64Array(period * period);
  const gy = new Float64Array(period * period);
  for (let i = 0; i < period * period; i++) {
    const t = rand() * Math.PI * 2;
    gx[i] = Math.cos(t);
    gy[i] = Math.sin(t);
  }
  const fade = (t) => t * t * (3 - 2 * t); // feTurbulence uses the s-curve 3t²−2t³
  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const dot = (ix, iy, dx, dy) => {
      const k = (((iy % period) + period) % period) * period + (((ix % period) + period) % period);
      return gx[k] * dx + gy[k] * dy;
    };
    const u = fade(fx);
    const v = fade(fy);
    const a = dot(x0, y0, fx, fy) + u * (dot(x0 + 1, y0, fx - 1, fy) - dot(x0, y0, fx, fy));
    const b = dot(x0, y0 + 1, fx, fy - 1) + u * (dot(x0 + 1, y0 + 1, fx - 1, fy - 1) - dot(x0, y0 + 1, fx, fy - 1));
    return a + v * (b - a);
  };
}

/** One feTurbulence fractalNoise channel in [0,1], stitched to SIZE. */
function channel(seed) {
  const octaves = [];
  for (let o = 0; o < OCTAVES; o++) {
    const periods = Math.max(1, Math.round(SIZE * BASE_FREQUENCY * 2 ** o));
    octaves.push({ noise: makePerlin(seed * 31 + o, periods), freq: periods / SIZE, amp: 1 / 2 ** o });
  }
  const out = new Float64Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let sum = 0;
      for (const { noise, freq, amp } of octaves) sum += noise((x + 0.5) * freq, (y + 0.5) * freq) * amp;
      out[y * SIZE + x] = Math.min(1, Math.max(0, (sum + 1) / 2));
    }
  }
  return out;
}

const [R, G, B, A] = [1, 2, 3, 4].map(channel);
const d = new Float64Array(SIZE * SIZE);
let dMax = 0;
let dSum = 0;
for (let i = 0; i < d.length; i++) {
  const lum = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
  d[i] = A[i] * (1 - lum);
  dMax = Math.max(dMax, d[i]);
  dSum += d[i];
}

// PNG: 8-bit grayscale + alpha, gray = 0 (black), alpha = d / dMax.
const raw = Buffer.alloc(SIZE * (SIZE * 2 + 1));
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE * 2 + 1);
  raw[row] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    raw[row + 1 + x * 2] = 0;
    raw[row + 2 + x * 2] = Math.round((d[y * SIZE + x] / dMax) * 255);
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 4; // grayscale + alpha
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'grain.png');
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes)`);
console.log(`dMax=${dMax.toFixed(4)} mean d=${(dSum / d.length).toFixed(4)}`);
console.log(`render opacity for web-equivalent strength (0.08 · dMax): ${(0.08 * dMax).toFixed(4)}`);
