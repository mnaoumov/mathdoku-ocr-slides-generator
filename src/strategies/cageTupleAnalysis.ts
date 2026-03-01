import type { Cell } from '../Puzzle.ts';

import { evaluateTuple } from '../combinatorics.ts';
import { Operator } from '../Puzzle.ts';
import { ensureNonNullable } from '../typeGuards.ts';
import {
  BINARY_CELL_COUNT,
  canBeOperator,
  deduceOperator
} from './cageOperationBounds.ts';

const BINARY_OPERATORS: readonly Operator[] = [Operator.Divide, Operator.Minus, Operator.Plus, Operator.Times];
const MULTI_CELL_OPERATORS: readonly Operator[] = [Operator.Plus, Operator.Times];

export function adjustTargetForSolvedCells(
  cageValue: number,
  operator: Operator,
  solvedValues: readonly number[]
): null | number {
  if (solvedValues.length === 0) {
    return cageValue;
  }
  if (operator === Operator.Plus) {
    return cageValue - solvedValues.reduce((s, v) => s + v, 0);
  }
  if (operator === Operator.Times) {
    const product = solvedValues.reduce((p, v) => p * v, 1);
    if (product === 0 || cageValue % product !== 0) {
      return null;
    }
    return cageValue / product;
  }
  // - and / are binary: if both unsolved, target = cageValue; if 1 unsolved, skip
  return null;
}

export function enumerateValidTuples(
  unsolvedCells: readonly Cell[],
  target: number,
  operator: Operator
): number[][] {
  const tuples: number[][] = [];
  const cellCount = unsolvedCells.length;

  function search(tuple: number[], depth: number): void {
    if (depth === cellCount) {
      if (evaluateTuple(tuple, operator) === target) {
        tuples.push([...tuple]);
      }
      return;
    }
    const cell = ensureNonNullable(unsolvedCells[depth]);
    for (const v of cell.getCandidates()) {
      let valid = true;
      for (let i = 0; i < depth; i++) {
        if (ensureNonNullable(tuple[i]) === v) {
          const prevCell = ensureNonNullable(unsolvedCells[i]);
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

export function getOperatorsForCage(
  hasOperators: boolean,
  cageOperator: Operator,
  cageValue: number,
  cellCount: number,
  puzzleSize: number
): Operator[] {
  if (hasOperators && cageOperator !== Operator.Unknown) {
    return [cageOperator];
  }
  const deduced = deduceOperator(cageValue, cellCount, puzzleSize);
  if (deduced !== Operator.Unknown) {
    return [deduced];
  }

  const possibleOperators = cellCount === BINARY_CELL_COUNT
    ? BINARY_OPERATORS
    : MULTI_CELL_OPERATORS;

  return [...possibleOperators].filter((op) => canBeOperator(op, cageValue, cellCount, puzzleSize));
}
