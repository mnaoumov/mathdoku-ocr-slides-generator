/**
 * Initialize a solution YAML from a puzzle YAML.
 *
 * Runs init strategies + automated strategies in Node.js, writes <name>.solution.yaml.
 *
 * Usage: npm run init-solution -- path/to/puzzle.yaml
 */

/* eslint-disable no-console -- CLI script output. */

import yaml from 'js-yaml';
import {
  readFileSync,
  writeFileSync
} from 'node:fs';
import {
  basename,
  dirname,
  resolve
} from 'node:path';

import {
  initPuzzleSlides,
  parsePuzzleJson
} from '../src/Puzzle.ts';
import {
  buildPuzzleJson,
  type YamlSpec
} from '../src/puzzleYamlParser.ts';
import { buildSolutionYaml } from '../src/SolutionYaml.ts';
import {
  createInitialStrategies,
  createStrategies
} from '../src/strategies/createDefaultStrategies.ts';
import { SvgRenderer } from '../src/SvgRenderer.ts';

const YAML_ARG_INDEX = 2;

const yamlPath = process.argv[YAML_ARG_INDEX];
if (!yamlPath) {
  console.error('Usage: npm run init-solution -- <puzzle.yaml>');
  process.exit(1);
}

const resolvedPath = resolve(yamlPath);
const yamlContent = readFileSync(resolvedPath, 'utf-8');
const puzzleName = basename(resolvedPath).replace(/\.ya?ml$/i, '');

console.log(`Loading puzzle: ${resolvedPath}`);

const spec = yaml.load(yamlContent) as YamlSpec;
const puzzleJson = parsePuzzleJson(buildPuzzleJson(spec, puzzleName));

const renderer = new SvgRenderer();
renderer.initGrid(
  puzzleJson.puzzleSize,
  puzzleJson.cages,
  puzzleJson.hasOperators ?? true,
  puzzleJson.title ?? '',
  puzzleJson.meta ?? ''
);
renderer.pushInitialSlide();

initPuzzleSlides({
  cages: puzzleJson.cages,
  hasOperators: puzzleJson.hasOperators !== false,
  initialStrategies: createInitialStrategies(),
  meta: puzzleJson.meta ?? '',
  puzzleSize: puzzleJson.puzzleSize,
  renderer,
  strategies: createStrategies(puzzleJson.puzzleSize),
  title: puzzleJson.title ?? ''
});

const manualNotes = renderer.slides.map((slide) => slide.notes);

const solutionYaml = buildSolutionYaml({
  hasOperators: puzzleJson.hasOperators !== false,
  manualNotes,
  puzzleJson,
  slides: renderer.slides
});

const outputPath = resolve(dirname(resolvedPath), `${puzzleName}.solution.yaml`);
writeFileSync(outputPath, solutionYaml, 'utf-8');
console.log(`Solution written: ${outputPath}`);
console.log(`${String(renderer.slides.length)} slides generated`);

/* eslint-enable no-console -- End CLI script output. */
