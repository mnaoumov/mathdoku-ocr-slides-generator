import {
  dirname,
  resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const ROOT = dirname(fileURLToPath(import.meta.url));
const APP_SRC = resolve(ROOT, 'src', 'app');

export default defineConfig({
  publicDir: resolve(ROOT, 'assets'),
  root: APP_SRC,
  server: {
    open: true
  }
});
