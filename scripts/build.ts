/**
 * Build Apps Script bundle from src/ ES modules.
 *
 * Uses Vite (Rollup) to produce a single Code.js with top-level function
 * declarations suitable for Google Apps Script.
 *
 * Also compiles dialog HTML files from TypeScript + CSS source files
 * in src/dialogs/.
 *
 * Usage: npm run build   (or: jiti scripts/build.ts)
 */

/* eslint-disable no-console -- CLI script output. */

import type { Plugin } from 'vite';

import { transform } from 'esbuild';
import {
  readFileSync,
  writeFileSync
} from 'node:fs';
import {
  dirname,
  resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src');
const DIST = resolve(ROOT, 'dist');
const DIALOGS_SRC = resolve(SRC, 'dialogs');
const DIALOG_NAMES = ['EnterDialog', 'ProgressDialog'];
const STYLE_MARKER = '/*__STYLE__*/';
const SCRIPT_MARKER = '/*__SCRIPT__*/';

/**
 * Compile dialog HTML files from TypeScript + CSS sources.
 *
 * For each dialog folder in src/dialogs/:
 * 1. Read template.html, style.css, script.ts
 * 2. Compile TS to JS via esbuild
 * 3. Inject CSS and JS into the HTML template
 * 4. Write the result to dist/
 */
async function buildDialogs(): Promise<void> {
  for (const name of DIALOG_NAMES) {
    const dir = resolve(DIALOGS_SRC, name);
    const template = readFileSync(resolve(dir, 'template.html'), 'utf8');
    const css = readFileSync(resolve(dir, 'style.css'), 'utf8');
    const ts = readFileSync(resolve(dir, 'script.ts'), 'utf8');

    const { code: js } = await transform(ts, { loader: 'ts', target: 'es2019' });

    const html = template
      .replace(STYLE_MARKER, css)
      .replace(SCRIPT_MARKER, js.trimEnd());

    writeFileSync(resolve(DIST, `${name}.html`), html);
    console.log(`Built: dist/${name}.html`);
  }
}

async function main(): Promise<void> {
  await build({
    build: {
      emptyOutDir: false,
      lib: {
        entry: resolve(SRC, 'main.ts'),
        fileName: 'Code',
        formats: ['es']
      },
      minify: false,
      outDir: DIST,
      rollupOptions: {
        output: {
          entryFileNames: 'Code.js'
        }
      },
      target: 'es2019'
    },
    logLevel: 'info',
    plugins: [stripExports()],
    root: ROOT
  });

  console.log('Build complete: dist/Code.js');

  await buildDialogs();
}

/**
 * Vite plugin that strips ES module export statements from the bundle,
 * making the output compatible with Google Apps Script (global scope).
 */
function stripExports(): Plugin {
  return {
    enforce: 'post',
    name: 'strip-exports',
    renderChunk(code: string): string {
      return code.replace(/^export\s*\{[^}]*\};\s*$/gm, '');
    }
  };
}

await main();

/* eslint-enable no-console -- End CLI script output. */
