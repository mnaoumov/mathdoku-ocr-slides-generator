import type { CageRaw } from './Puzzle.ts';

import { getCellRef } from './parsers.ts';
import { Operator } from './Puzzle.ts';
import { ensureNonNullable } from './typeGuards.ts';

const BINARY_OP_SIZE = 2;
const FIRST_INNER_BOUNDARY_ID = 2;

export class GridBoundaries {
  private readonly horizontalBounds: boolean[][];
  private readonly puzzleSize: number;
  private readonly verticalBounds: boolean[][];

  public constructor(cages: readonly CageRaw[], puzzleSize: number) {
    this.puzzleSize = puzzleSize;

    const cellToCage: Record<string, number> = {};
    for (let cageId = 1; cageId <= cages.length; cageId++) {
      const cage = ensureNonNullable(cages[cageId - 1]);
      for (const cell of cage.cells) {
        cellToCage[cell] = cageId;
      }
    }

    const verticalBounds: boolean[][] = [];
    const horizontalBounds: boolean[][] = [];
    for (let rowId = 1; rowId <= puzzleSize; rowId++) {
      const row: boolean[] = [];
      verticalBounds[rowId - 1] = row;
      for (let columnId = FIRST_INNER_BOUNDARY_ID; columnId <= puzzleSize; columnId++) {
        row[columnId - FIRST_INNER_BOUNDARY_ID] = cellToCage[getCellRef(rowId, columnId - 1)] !== cellToCage[getCellRef(rowId, columnId)];
      }
    }
    for (let rowId = FIRST_INNER_BOUNDARY_ID; rowId <= puzzleSize; rowId++) {
      const row: boolean[] = [];
      horizontalBounds[rowId - FIRST_INNER_BOUNDARY_ID] = row;
      for (let columnId = 1; columnId <= puzzleSize; columnId++) {
        row[columnId - 1] = cellToCage[getCellRef(rowId - 1, columnId)] !== cellToCage[getCellRef(rowId, columnId)];
      }
    }

    this.verticalBounds = verticalBounds;
    this.horizontalBounds = horizontalBounds;
  }

  public hasBottomBound(rowId: number, columnId: number): boolean {
    if (rowId >= this.puzzleSize) {
      return true;
    }
    return ensureNonNullable(ensureNonNullable(this.horizontalBounds[rowId - 1])[columnId - 1]);
  }

  public hasLeftBound(rowId: number, columnId: number): boolean {
    if (columnId <= 1) {
      return true;
    }
    return ensureNonNullable(ensureNonNullable(this.verticalBounds[rowId - 1])[columnId - FIRST_INNER_BOUNDARY_ID]);
  }

  public hasRightBound(rowId: number, columnId: number): boolean {
    if (columnId >= this.puzzleSize) {
      return true;
    }
    return ensureNonNullable(ensureNonNullable(this.verticalBounds[rowId - 1])[columnId - 1]);
  }

  public hasTopBound(rowId: number, columnId: number): boolean {
    if (rowId <= 1) {
      return true;
    }
    return ensureNonNullable(ensureNonNullable(this.horizontalBounds[rowId - FIRST_INNER_BOUNDARY_ID])[columnId - 1]);
  }
}

export function evaluateTuple(tuple: readonly number[], operator: Operator): null | number {
  if (tuple.length === 0) {
    return null;
  }
  if (tuple.length === 1) {
    return ensureNonNullable(tuple[0]);
  }

  const a = ensureNonNullable(tuple[0]);
  const b = ensureNonNullable(tuple[1]);

  switch (operator) {
    case Operator.Divide: {
      if (tuple.length !== BINARY_OP_SIZE) {
        return null;
      }
      const maxD = Math.max(a, b);
      const minD = Math.min(a, b);
      if (minD === 0) {
        return null;
      }
      return maxD % minD === 0 ? maxD / minD : null;
    }
    case Operator.Minus: {
      if (tuple.length !== BINARY_OP_SIZE) {
        return null;
      }
      return Math.abs(a - b);
    }
    case Operator.Plus: {
      let sum = 0;
      for (const d of tuple) {
        sum += d;
      }
      return sum;
    }
    case Operator.Times: {
      let product = 1;
      for (const d of tuple) {
        product *= d;
      }
      return product;
    }
    case Operator.Unknown:
    default:
      return null;
  }
}

export function generateSubsets<T>(items: readonly T[], subsetSize: number): T[][] {
  if (subsetSize === 0) {
    return [[]];
  }
  if (subsetSize > items.length) {
    return [];
  }

  const results: T[][] = [];
  const indices: number[] = Array.from({ length: subsetSize }, (_, i) => i);

  for (;;) {
    results.push(indices.map((idx) => ensureNonNullable(items[idx])));

    let pos = subsetSize - 1;
    while (pos >= 0 && ensureNonNullable(indices[pos]) === pos + items.length - subsetSize) {
      pos--;
    }
    if (pos < 0) {
      break;
    }
    indices[pos] = ensureNonNullable(indices[pos]) + 1;
    for (let j = pos + 1; j < subsetSize; j++) {
      indices[j] = ensureNonNullable(indices[j - 1]) + 1;
    }
  }

  return results;
}
