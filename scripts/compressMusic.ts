/**
 * Compress background music MP3 and pre-encode as base64 for embedding
 * in exported presentations.
 *
 * Converts to 48 kbps mono — sufficient for background music and
 * small enough to embed as base64 without hitting browser limits.
 * Writes `assets/music.b64` (text file) consumed at export time.
 *
 * Usage: npm run compressMusic
 * Requires: ffmpeg on PATH
 */

/* eslint-disable no-console -- CLI script output. */
/* eslint-disable no-magic-numbers -- CLI constants. */

import { execSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import {
  dirname,
  resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MUSIC_PATH = resolve(ROOT, 'assets', 'music.mp3');
const COMPRESSED_PATH = resolve(ROOT, 'assets', 'music.compressed.mp3');
const BASE64_PATH = resolve(ROOT, 'assets', 'music.b64');
const BITRATE = '48k';
const KB = 1024;

if (!existsSync(MUSIC_PATH)) {
  console.error(`File not found: ${MUSIC_PATH}`);
  process.exit(1);
}

const sizeBefore = statSync(MUSIC_PATH).size;
console.log(`Input: ${MUSIC_PATH} (${String(Math.round(sizeBefore / KB))} KB)`);

try {
  execSync(
    `ffmpeg -y -i "${MUSIC_PATH}" -ac 1 -b:a ${BITRATE} "${COMPRESSED_PATH}"`,
    { stdio: 'inherit' }
  );
} catch {
  console.error('ffmpeg failed. Is ffmpeg installed and on PATH?');
  if (existsSync(COMPRESSED_PATH)) {
    unlinkSync(COMPRESSED_PATH);
  }
  process.exit(1);
}

const mp3Bytes = readFileSync(COMPRESSED_PATH);
const base64 = mp3Bytes.toString('base64');
writeFileSync(BASE64_PATH, base64);
unlinkSync(COMPRESSED_PATH);

const sizeAfter = mp3Bytes.length;
console.log(`Compressed: ${String(Math.round(sizeAfter / KB))} KB (${String(Math.round(sizeAfter / sizeBefore * 100))}% of original)`);
console.log(`Base64: ${BASE64_PATH} (${String(Math.round(base64.length / KB))} KB)`);

/* eslint-enable no-magic-numbers -- End CLI constants. */
/* eslint-enable no-console -- End CLI script output. */
