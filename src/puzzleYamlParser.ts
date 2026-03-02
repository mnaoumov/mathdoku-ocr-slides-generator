import type {
  CageRaw,
  PuzzleJson
} from './Puzzle.ts';

import { Operator } from './Puzzle.ts';

export interface YamlCage {
  cells?: unknown[];
  op?: string;
  operator?: string;
  value?: number;
}

export interface YamlSpec {
  cages?: unknown;
  difficulty?: string;
  hasOperators?: boolean;
  meta?: string;
  size?: number;
  title?: string;
}

const OPERATOR_MAP: Record<string, Operator> = {
  '-': Operator.Minus,
  '*': Operator.Times,
  '/': Operator.Divide,
  '+': Operator.Plus,
  'x': Operator.Times
};

export function buildPuzzleJson(spec: YamlSpec, name: string): PuzzleJson {
  if (spec.size === undefined) {
    throw new Error('size is required in YAML spec');
  }
  const n = spec.size;
  const difficulty = spec.difficulty;
  const hasOperators = spec.hasOperators ?? true;

  let title = (spec.title ?? '').trim();
  if (!title) {
    title = `#Mathdoku ${name}`;
  }

  let meta = (spec.meta ?? '').trim();
  if (!meta) {
    const parts = [`Size ${String(n)}x${String(n)}`];
    if (difficulty !== undefined) {
      parts.push(`Difficulty ${difficulty}`);
    }
    parts.push(hasOperators ? 'With operators' : 'Without operators');
    meta = parts.join(' \u2022 ');
  }

  const cagesIn = spec.cages;
  if (!Array.isArray(cagesIn) || cagesIn.length === 0) {
    throw new Error('cages must be a non-empty list');
  }

  const cages: CageRaw[] = [];
  for (const [idx, item] of (cagesIn as YamlCage[]).entries()) {
    const cellsRaw = item.cells;
    if (!Array.isArray(cellsRaw) || cellsRaw.length === 0) {
      throw new Error(`cages[${String(idx)}].cells must be a non-empty list`);
    }
    const cells = cellsRaw.map((c) => String(c).trim().toUpperCase());

    if (item.value === undefined) {
      throw new Error(`cages[${String(idx)}].value is required`);
    }

    const operator = parseOperator(item.op ?? item.operator);
    cages.push({ cells, operator, value: item.value });
  }

  return { cages, hasOperators, meta, puzzleSize: n, title };
}

export function parseOperator(op: string | undefined): Operator {
  if (op === undefined) {
    return Operator.Unknown;
  }
  return OPERATOR_MAP[op.trim()] ?? Operator.Unknown;
}
