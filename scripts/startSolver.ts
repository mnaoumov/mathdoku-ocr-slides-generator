/**
 * Start the Mathdoku solver dev server with a pre-loaded YAML puzzle.
 *
 * Usage: npm run startSolver -- path/to/puzzle.yaml
 *        (or: jiti scripts/startSolver.ts path/to/puzzle.yaml)
 */

/* eslint-disable no-console -- CLI script output. */

import { readFileSync } from 'node:fs';
import {
  dirname,
  resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP_SRC = resolve(ROOT, 'src', 'app');
const YAML_ARG_INDEX = 2;

const yamlPath = process.argv[YAML_ARG_INDEX];
if (!yamlPath) {
  console.error('Usage: npm run startSolver -- <puzzle.yaml>');
  process.exit(1);
}

const resolvedPath = resolve(yamlPath);
const yamlContent = readFileSync(resolvedPath, 'utf-8');
const puzzleName = resolvedPath.replace(/\\/g, '/').split('/').pop()?.replace(/\.ya?ml$/i, '') ?? 'puzzle';

console.log(`Loading puzzle: ${resolvedPath}`);

const server = await createServer({
  plugins: [
    {
      configureServer(srv): void {
        srv.middlewares.use('/api/puzzle', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ content: yamlContent, name: puzzleName }));
        });
      },
      name: 'puzzle-yaml-middleware'
    }
  ],
  publicDir: resolve(ROOT, 'assets'),
  root: APP_SRC,
  server: {
    open: true
  }
});

await server.listen();
server.printUrls();

/* eslint-enable no-console -- End CLI script output. */
