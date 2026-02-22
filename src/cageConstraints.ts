import type { CellValueSetter } from './Puzzle.ts';
import type { ChangeGroup } from './strategies/Strategy.ts';

import { CandidatesChange } from './cellChanges/CandidatesChange.ts';
import { CandidatesStrikethrough } from './cellChanges/CandidatesStrikethrough.ts';
import { ValueChange } from './cellChanges/ValueChange.ts';
import { evaluateTuple } from './combinatorics.ts';
import {
  Cage,
  Cell
} from './Puzzle.ts';
import { ensureNonNullable } from './typeGuards.ts';

export interface CageConstraintContext {
  readonly cage: Cage;
  readonly hasOperators: boolean;
  readonly puzzleSize: number;
}

export interface CageTupleOptions {
  readonly cells: readonly Cell[];
  readonly operator: string;
  readonly puzzleSize: number;
  readonly value: number;
}

export function applyCageConstraint(
  ctx: CageConstraintContext
): { candidateGroups: ChangeGroup[]; valueSetters: CellValueSetter[] } {
  const { cage, puzzleSize } = ctx;
  const cageValue = cage.value;

  const tuples = collectCageTuples(cageValue, ctx);
  if (tuples.length === 0) {
    return { candidateGroups: [], valueSetters: [] };
  }

  if (tuples.length === 1) {
    const tuple = ensureNonNullable(tuples[0]);
    const valueSetters: CellValueSetter[] = [];
    for (let i = 0; i < cage.cells.length; i++) {
      valueSetters.push({ cell: ensureNonNullable(cage.cells[i]), value: ensureNonNullable(tuple[i]) });
    }
    return { candidateGroups: [], valueSetters };
  }

  const distinctSets = new Set<string>(tuples.map(
    (t) => [...new Set(t)].sort((a, b) => a - b).join(',')
  ));
  if (distinctSets.size !== 1) {
    return { candidateGroups: [], valueSetters: [] };
  }

  const narrowedValues = ensureNonNullable([...distinctSets][0]).split(',').map(Number);
  if (narrowedValues.length >= puzzleSize) {
    return { candidateGroups: [], valueSetters: [] };
  }

  const candidateChanges = cage.cells.map((cell) => new CandidatesChange(cell, narrowedValues));
  return {
    candidateGroups: [{ changes: candidateChanges, reason: 'unique cage multiset' }],
    valueSetters: []
  };
}

export function buildAutoEliminateGroup(
  setter: CellValueSetter,
  reason: string
): ChangeGroup {
  const changes = [
    new ValueChange(setter.cell, setter.value),
    ...setter.cell.peers.map((peer) => new CandidatesStrikethrough(peer, [setter.value]))
  ];
  return { changes, reason };
}

export function collectCageTuples(
  cageValue: number,
  ctx: CageConstraintContext
): number[][] {
  const { cage, hasOperators, puzzleSize } = ctx;
  if (hasOperators && cage.operator) {
    return computeValidCageTuples({ cells: cage.cells, operator: cage.operator, puzzleSize, value: cageValue });
  }
  const tupleSet = new Set<string>();
  const tuples: number[][] = [];
  for (const op of ['+', '-', 'x', '/']) {
    for (const t of computeValidCageTuples({ cells: cage.cells, operator: op, puzzleSize, value: cageValue })) {
      const key = t.join(',');
      if (!tupleSet.has(key)) {
        tupleSet.add(key);
        tuples.push(t);
      }
    }
  }
  return tuples;
}

export function computeValidCageTuples(options: CageTupleOptions): number[][] {
  const { cells, operator, puzzleSize, value } = options;
  const tuples: number[][] = [];
  const numCells = cells.length;

  function search(tuple: number[], depth: number): void {
    if (depth === numCells) {
      if (evaluateTuple(tuple, operator) === value) {
        tuples.push([...tuple]);
      }
      return;
    }
    const cell = ensureNonNullable(cells[depth]);
    for (let v = 1; v <= puzzleSize; v++) {
      let valid = true;
      for (let i = 0; i < depth; i++) {
        if (ensureNonNullable(tuple[i]) === v) {
          const prevCell = ensureNonNullable(cells[i]);
          if (prevCell.row === cell.row || prevCell.column === cell.column) {
            valid = false;
            break;
          }
        }
      }
      if (!valid) {
        continue;
      }
      tuple.push(v);
      search(tuple, depth + 1);
      tuple.pop();
    }
  }

  search([], 0);
  return tuples;
}
