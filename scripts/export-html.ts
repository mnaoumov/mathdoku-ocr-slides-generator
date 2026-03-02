/**
 * Export a solution YAML to a self-contained Reveal.js HTML presentation.
 *
 * Usage: npm run export-html -- path/to/solution.yaml
 */

/* eslint-disable no-console -- CLI script output. */

import {
  readFileSync,
  writeFileSync
} from 'node:fs';
import {
  basename,
  dirname,
  resolve
} from 'node:path';

import { generateHtml } from '../src/app/ExportService.ts';
import {
  parseSolutionYaml,
  puzzleJsonFromSolution,
  replaySolution
} from '../src/SolutionYaml.ts';
import {
  getSolveNotesRect,
  SvgRenderer
} from '../src/SvgRenderer.ts';

const YAML_ARG_INDEX = 2;

const solutionPath = process.argv[YAML_ARG_INDEX];
if (!solutionPath) {
  console.error('Usage: npm run export-html -- <solution.yaml>');
  process.exit(1);
}

const resolvedPath = resolve(solutionPath);
const solutionContent = readFileSync(resolvedPath, 'utf-8');
const solutionName = basename(resolvedPath).replace(/\.solution\.ya?ml$/i, '').replace(/\.ya?ml$/i, '');

console.log(`Loading solution: ${resolvedPath}`);

const solution = parseSolutionYaml(solutionContent);
const puzzleJson = puzzleJsonFromSolution(solution);

const renderer = new SvgRenderer();
renderer.initGrid(
  puzzleJson.puzzleSize,
  puzzleJson.cages,
  puzzleJson.hasOperators ?? true,
  puzzleJson.title ?? '',
  puzzleJson.meta ?? ''
);
renderer.pushInitialSlide();

const result = replaySolution({
  puzzleJson,
  renderer,
  steps: solution.steps
});

const solveNotesRect = getSolveNotesRect(puzzleJson.puzzleSize);
const title = puzzleJson.title ?? solutionName;

const html = generateHtml({
  manualNotes: result.manualNotes,
  slides: renderer.slides,
  solveNotesRect,
  title
});

const outputPath = resolve(dirname(resolvedPath), `${solutionName}.html`);
writeFileSync(outputPath, html, 'utf-8');
console.log(`HTML written: ${outputPath}`);
console.log(`${String(renderer.slides.length)} slides exported`);

/* eslint-enable no-console -- End CLI script output. */
