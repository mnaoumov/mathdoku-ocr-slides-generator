/**
 * Build browser app bundle from src/app/ entry point.
 *
 * Uses Vite to produce dist/ with index.html, bundled JS/CSS.
 *
 * Usage: npm run build   (or: jiti scripts/build.ts)
 */

/* eslint-disable no-console -- CLI script output. */

import {
  dirname,
  resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP_SRC = resolve(ROOT, 'src', 'app');

async function main(): Promise<void> {
  await build({
    build: {
      emptyOutDir: true,
      outDir: resolve(ROOT, 'dist'),
      rollupOptions: {
        input: resolve(APP_SRC, 'index.html')
      }
    },
    logLevel: 'info',
    plugins: [viteSingleFile({ removeViteModuleLoader: true })],
    root: APP_SRC
  });

  console.log('Build complete: dist/');
}

await main();

/* eslint-enable no-console -- End CLI script output. */
