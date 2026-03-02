import yaml from 'js-yaml';
import { z } from 'zod';

import type { CellChange } from './cellChanges/CellChange.ts';
import type { PuzzleJson } from './Puzzle.ts';
import type {
  YamlCage,
  YamlSpec
} from './puzzleYamlParser.ts';
import type { SlideSnapshot } from './SvgRenderer.ts';

import { CandidatesChange } from './cellChanges/CandidatesChange.ts';
import { CandidatesStrikethrough } from './cellChanges/CandidatesStrikethrough.ts';
import { ValueChange } from './cellChanges/ValueChange.ts';
import { parseCellRef } from './parsers.ts';
import {
  Operator,
  parsePuzzleJson,
  Puzzle,
  type PuzzleRenderer
} from './Puzzle.ts';
import { buildPuzzleJson } from './puzzleYamlParser.ts';
import {
  type SolutionCommand,
  solutionCommandSchema
} from './solutionCommand.ts';
import { createStrategies } from './strategies/createDefaultStrategies.ts';
import { ensureNonNullable } from './typeGuards.ts';

export type { SolutionCommand } from './solutionCommand.ts';
export {
  buildCommand,
  solutionCommandSchema
} from './solutionCommand.ts';

const SLIDE_PAIR_SIZE = 2;

const solutionStepSchema = z.object({
  command: solutionCommandSchema,
  note: z.string()
}).readonly();

export type SolutionStep = z.infer<typeof solutionStepSchema>;

export interface SolutionYamlData {
  readonly puzzle: SolutionPuzzle;
  readonly steps: readonly SolutionStep[];
}

interface SolutionCage {
  readonly cells: readonly string[];
  readonly operator?: string | undefined;
  readonly value: number;
}

interface SolutionPuzzle {
  readonly cages: readonly SolutionCage[];
  readonly difficulty?: string | undefined;
  readonly hasOperators: boolean;
  readonly meta?: string | undefined;
  readonly size: number;
  readonly title?: string | undefined;
}

const solutionCageSchema = z.object({
  cells: z.array(z.string()),
  operator: z.string().optional(),
  value: z.number()
}).readonly();

const solutionPuzzleSchema = z.object({
  cages: z.array(solutionCageSchema),
  difficulty: z.string().optional(),
  hasOperators: z.boolean(),
  meta: z.string().optional(),
  size: z.number(),
  title: z.string().optional()
}).readonly();

const solutionYamlSchema = z.object({
  puzzle: solutionPuzzleSchema,
  steps: z.array(solutionStepSchema)
}).readonly();

export interface BuildSolutionYamlParams {
  readonly hasOperators: boolean;
  readonly manualNotes: readonly string[];
  readonly puzzleJson: PuzzleJson;
  readonly slides: readonly SlideSnapshot[];
}

export interface ReplaySolutionParams {
  readonly puzzleJson: PuzzleJson;
  readonly renderer: PuzzleRenderer;
  readonly steps: readonly SolutionStep[];
}

export interface ReplaySolutionResult {
  readonly manualNotes: string[];
  readonly puzzle: Puzzle;
  readonly puzzleJson: PuzzleJson;
}

const OPERATOR_YAML_MAP: Partial<Record<Operator, string>> = {
  [Operator.Divide]: '/',
  [Operator.Minus]: '-',
  [Operator.Plus]: '+',
  [Operator.Times]: 'x'
};

export function buildSolutionYaml(params: BuildSolutionYamlParams): string {
  const { hasOperators, manualNotes, puzzleJson, slides } = params;

  const puzzle: SolutionPuzzle = {
    cages: puzzleJson.cages.map((cage) => {
      const result: SolutionCage = { cells: [...cage.cells], value: cage.value };
      if (hasOperators && cage.operator !== Operator.Exact && cage.operator !== Operator.Unknown) {
        return { ...result, operator: OPERATOR_YAML_MAP[cage.operator] ?? cage.operator };
      }
      return result;
    }),
    hasOperators,
    size: puzzleJson.puzzleSize,
    ...puzzleJson.title !== undefined && { title: puzzleJson.title },
    ...puzzleJson.meta !== undefined && { meta: puzzleJson.meta }
  };

  const steps: SolutionStep[] = [];
  const stepCount = Math.floor((slides.length - 1) / SLIDE_PAIR_SIZE);

  for (let i = 0; i < stepCount; i++) {
    const pendingIndex = 1 + i * SLIDE_PAIR_SIZE;
    const pendingSlide = slides[pendingIndex];
    if (!pendingSlide) {
      continue;
    }

    const slideCommand = pendingSlide.command;
    const note = manualNotes[pendingIndex] ?? pendingSlide.notes;

    steps.push({
      command: slideCommand,
      note
    });
  }

  const data = { puzzle, steps };
  const raw = yaml.dump(data, { lineWidth: -1, noRefs: true, quotingType: '"', sortKeys: false });
  // Convert block-style cell arrays to flow-style: "cells:\n  - A1\n  - B1" -> "cells: [A1, B1]"
  return raw.replace(/cells:\n(?:\s+-\s+[A-Z]\d+\n)+/g, (match) => {
    const cells = [...match.matchAll(/-\s+(?<ref>[A-Z]\d+)/g)].map((m) => m.groups?.['ref']);
    return `cells: [${cells.join(', ')}]\n`;
  });
}

export function parseSolutionYaml(content: string): SolutionYamlData {
  const raw = yaml.load(content);
  return solutionYamlSchema.parse(raw);
}

export function puzzleJsonFromSolution(solution: SolutionYamlData): PuzzleJson {
  const spec: YamlSpec = {
    cages: solution.puzzle.cages.map((cage) => {
      const result: YamlCage = { cells: [...cage.cells], value: cage.value };
      if (cage.operator !== undefined) {
        return { ...result, operator: cage.operator };
      }
      return result;
    }),
    hasOperators: solution.puzzle.hasOperators,
    size: solution.puzzle.size,
    ...solution.puzzle.difficulty !== undefined && { difficulty: solution.puzzle.difficulty },
    ...solution.puzzle.meta !== undefined && { meta: solution.puzzle.meta },
    ...solution.puzzle.title !== undefined && { title: solution.puzzle.title }
  };
  const name = solution.puzzle.title?.replace(/^#Mathdoku\s*/i, '') ?? 'puzzle';
  return parsePuzzleJson(buildPuzzleJson(spec, name));
}

export function replaySolution(params: ReplaySolutionParams): ReplaySolutionResult {
  const { puzzleJson, renderer, steps } = params;

  const puzzle = new Puzzle({
    cages: puzzleJson.cages,
    hasOperators: puzzleJson.hasOperators !== false,
    meta: puzzleJson.meta ?? '',
    puzzleSize: puzzleJson.puzzleSize,
    renderer,
    strategies: createStrategies(puzzleJson.puzzleSize),
    title: puzzleJson.title ?? ''
  });

  // Replay each step (init strategy steps are stored as command objects in the YAML)
  for (const step of steps) {
    const stepChanges = resolveCommand(puzzle, step.command);
    renderer.setNoteText(step.note);
    renderer.setCommand(step.command);
    puzzle.applyChanges(stepChanges);
    puzzle.commit();
  }

  return { manualNotes: buildManualNotes(steps), puzzle, puzzleJson };
}

export function resolveCommand(puzzle: Puzzle, command: SolutionCommand): CellChange[] {
  const changes: CellChange[] = [];

  for (const [key, value] of Object.entries(command)) {
    const cells = resolveSelector(puzzle, key);

    if (typeof value === 'string' && value.startsWith('=')) {
      // Value assignment
      const numValue = parseInt(value.substring(1), 10);
      for (const cell of cells) {
        changes.push(new ValueChange(cell, numValue));
        // Auto-add peer strikethroughs
        for (const peer of cell.peers) {
          changes.push(new CandidatesStrikethrough(peer, [numValue]));
        }
      }
    } else if (typeof value === 'number' && value > 0) {
      // Candidates
      const digits = Array.from(String(value), (ch) => parseInt(ch, 10));
      for (const cell of cells) {
        changes.push(new CandidatesChange(cell, digits));
      }
    } else if (typeof value === 'number' && value < 0) {
      // Strikethrough
      const digits = Array.from(String(Math.abs(value)), (ch) => parseInt(ch, 10));
      for (const cell of cells) {
        changes.push(new CandidatesStrikethrough(cell, digits));
      }
    }
  }

  return changes;
}

function buildManualNotes(steps: readonly SolutionStep[]): string[] {
  const notes: string[] = [''];

  for (const step of steps) {
    notes.push(step.note);
    notes.push('');
  }

  return notes;
}

function resolveSelector(puzzle: Puzzle, key: string): readonly import('./Puzzle.ts').Cell[] {
  // @C3 — cage cells
  if (key.startsWith('@')) {
    const anchor = puzzle.getCell(key.substring(1));
    return anchor.cage.cells;
  }

  // (A1 B2 C3) — explicit group
  if (key.startsWith('(') && key.endsWith(')')) {
    const inner = key.substring(1, key.length - 1).trim();
    return inner.split(/\s+/).map((ref) => puzzle.getCell(ref));
  }

  // A1-E5 — rectangular range
  const rangeMatch = /^(?<start>[A-Z]\d+)-(?<end>[A-Z]\d+)$/i.exec(key);
  if (rangeMatch) {
    const groups = ensureNonNullable(rangeMatch.groups);
    const start = parseCellRef(ensureNonNullable(groups['start']));
    const end = parseCellRef(ensureNonNullable(groups['end']));
    const minRow = Math.min(start.rowId, end.rowId);
    const maxRow = Math.max(start.rowId, end.rowId);
    const minCol = Math.min(start.columnId, end.columnId);
    const maxCol = Math.max(start.columnId, end.columnId);
    const cells: import('./Puzzle.ts').Cell[] = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        cells.push(puzzle.getCell(r, c));
      }
    }
    return cells;
  }

  // Single cell ref
  return [puzzle.getCell(key)];
}
