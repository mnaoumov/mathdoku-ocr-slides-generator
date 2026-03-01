import type {
  Cell,
  House,
  HouseType
} from '../Puzzle.ts';

import { Operator } from '../Puzzle.ts';
import { ensureNonNullable } from '../typeGuards.ts';

export const BINARY_CELL_COUNT = 2;

export function canBeOperator(
  operator: Operator,
  cageValue: number,
  cells: readonly Cell[],
  puzzleSize: number
): boolean {
  const cellCount = cells.length;
  switch (operator) {
    case Operator.Divide:
      return cellCount === BINARY_CELL_COUNT && cageValue >= BINARY_CELL_COUNT && cageValue <= puzzleSize;
    case Operator.Minus:
      return cellCount === BINARY_CELL_COUNT && cageValue >= 1 && cageValue < puzzleSize;
    case Operator.Plus: {
      const bounds = computeCageSumBounds(cells, puzzleSize);
      return cageValue >= bounds.min && cageValue <= bounds.max;
    }
    case Operator.Times:
      return canBeMultiplication(cageValue, cells, puzzleSize);
    case Operator.Unknown:
    default:
      return false;
  }
}

export function computeLatinSquareBound(
  targetCell: Cell,
  otherCells: readonly Cell[],
  value: number,
  puzzleSize: number,
  aggregateType: 'product' | 'sum',
  boundType: 'max' | 'min'
): number {
  const rowBound = computeHouseBound(targetCell, otherCells, value, puzzleSize, aggregateType, boundType, 'row');
  const colBound = computeHouseBound(targetCell, otherCells, value, puzzleSize, aggregateType, boundType, 'column');
  return boundType === 'min' ? Math.max(rowBound, colBound) : Math.min(rowBound, colBound);
}

export function deduceOperator(
  cageValue: number,
  cells: readonly Cell[],
  puzzleSize: number
): Operator {
  const possibleOperators = cells.length === BINARY_CELL_COUNT
    ? [Operator.Divide, Operator.Minus, Operator.Plus, Operator.Times]
    : [Operator.Plus, Operator.Times];

  const feasible = possibleOperators.filter((op) => canBeOperator(op, cageValue, cells, puzzleSize));
  return feasible.length === 1 ? ensureNonNullable(feasible[0]) : Operator.Unknown;
}

function canBeMultiplication(
  cageValue: number,
  cells: readonly Cell[],
  puzzleSize: number
): boolean {
  if (hasLargePrimeFactor(cageValue, puzzleSize)) {
    return false;
  }
  const cellCount = cells.length;
  if (cellCount === BINARY_CELL_COUNT) {
    return hasFactorPairInRange(cageValue, puzzleSize);
  }
  const bounds = computeCageProductBounds(cells, puzzleSize);
  return cageValue >= bounds.min && cageValue <= bounds.max;
}

function computeAxisBound(
  cells: readonly Cell[],
  puzzleSize: number,
  aggregateType: 'product' | 'sum',
  axis: HouseType
): { max: number; min: number } {
  const groups = new Map<number, number>();
  for (const cell of cells) {
    const houseId = axis === 'row' ? cell.row.id : cell.column.id;
    groups.set(houseId, (groups.get(houseId) ?? 0) + 1);
  }

  let min = aggregateType === 'sum' ? 0 : 1;
  let max = aggregateType === 'sum' ? 0 : 1;

  for (const count of groups.values()) {
    const groupMin = distinctAggregateBound(count, puzzleSize, aggregateType, 'min');
    const groupMax = distinctAggregateBound(count, puzzleSize, aggregateType, 'max');
    if (aggregateType === 'sum') {
      min += groupMin;
      max += groupMax;
    } else {
      min *= groupMin;
      max *= groupMax;
    }
  }

  return { max, min };
}

function computeCageProductBounds(
  cells: readonly Cell[],
  puzzleSize: number
): { max: number; min: number } {
  const rowBound = computeAxisBound(cells, puzzleSize, 'product', 'row');
  const colBound = computeAxisBound(cells, puzzleSize, 'product', 'column');
  return {
    max: Math.min(rowBound.max, colBound.max),
    min: Math.max(rowBound.min, colBound.min)
  };
}

function computeCageSumBounds(
  cells: readonly Cell[],
  puzzleSize: number
): { max: number; min: number } {
  const rowBound = computeAxisBound(cells, puzzleSize, 'sum', 'row');
  const colBound = computeAxisBound(cells, puzzleSize, 'sum', 'column');
  return {
    max: Math.min(rowBound.max, colBound.max),
    min: Math.max(rowBound.min, colBound.min)
  };
}

function computeHouseBound(
  targetCell: Cell,
  otherCells: readonly Cell[],
  value: number,
  puzzleSize: number,
  aggregateType: 'product' | 'sum',
  boundType: 'max' | 'min',
  houseType: HouseType
): number {
  const groups = new Map<number, Cell[]>();
  for (const cell of otherCells) {
    const houseId = houseType === 'row' ? cell.row.id : cell.column.id;
    const existing = groups.get(houseId);
    if (existing) {
      existing.push(cell);
    } else {
      groups.set(houseId, [cell]);
    }
  }

  const targetHouseId = houseType === 'row' ? targetCell.row.id : targetCell.column.id;

  let result = aggregateType === 'sum' ? 0 : 1;

  for (const [houseId, cells] of groups) {
    const house = houseType === 'row' ? ensureNonNullable(cells[0]).row : ensureNonNullable(cells[0]).column;
    const excluded = solvedValuesInHouse(house);
    if (houseId === targetHouseId) {
      excluded.add(value);
    }
    const fn = boundType === 'min' ? minDistinctAggregate : maxDistinctAggregate;
    const groupBound = fn(cells.length, puzzleSize, aggregateType, excluded);
    result = aggregateType === 'sum' ? result + groupBound : result * groupBound;
  }

  return result;
}

function distinctAggregateBound(
  count: number,
  puzzleSize: number,
  aggregateType: 'product' | 'sum',
  boundType: 'max' | 'min'
): number {
  if (aggregateType === 'product') {
    return distinctProductBound(count, puzzleSize, boundType);
  }
  return boundType === 'min'
    ? count * (count + 1) / BINARY_CELL_COUNT
    : count * puzzleSize - count * (count - 1) / BINARY_CELL_COUNT;
}

function distinctProductBound(
  cellCount: number,
  puzzleSize: number,
  boundType: 'max' | 'min'
): number {
  let result = 1;
  if (boundType === 'min') {
    for (let v = 1; v <= cellCount; v++) {
      result *= v;
    }
  } else {
    for (let v = puzzleSize; v > puzzleSize - cellCount; v--) {
      result *= v;
    }
  }
  return result;
}

function hasFactorPairInRange(value: number, maxFactor: number): boolean {
  for (let a = 1; a * a <= value; a++) {
    if (value % a === 0) {
      const b = value / a;
      if (a <= maxFactor && b <= maxFactor && a !== b) {
        return true;
      }
    }
  }
  return false;
}

function hasLargePrimeFactor(value: number, maxFactor: number): boolean {
  let remaining = value;
  for (let p = BINARY_CELL_COUNT; p <= maxFactor; p++) {
    while (remaining % p === 0) {
      remaining /= p;
    }
  }
  return remaining > 1;
}

function maxDistinctAggregate(
  count: number,
  puzzleSize: number,
  aggregateType: 'product' | 'sum',
  excludedValues: ReadonlySet<number>
): number {
  let result = aggregateType === 'sum' ? 0 : 1;
  let picked = 0;
  for (let v = puzzleSize; v >= 1 && picked < count; v--) {
    if (!excludedValues.has(v)) {
      result = aggregateType === 'sum' ? result + v : result * v;
      picked++;
    }
  }
  return result;
}

function minDistinctAggregate(
  count: number,
  puzzleSize: number,
  aggregateType: 'product' | 'sum',
  excludedValues: ReadonlySet<number>
): number {
  let result = aggregateType === 'sum' ? 0 : 1;
  let picked = 0;
  for (let v = 1; v <= puzzleSize && picked < count; v++) {
    if (!excludedValues.has(v)) {
      result = aggregateType === 'sum' ? result + v : result * v;
      picked++;
    }
  }
  return result;
}

function solvedValuesInHouse(house: House): Set<number> {
  const values = new Set<number>();
  for (const cell of house.cells) {
    if (cell.isSolved && cell.value !== null) {
      values.add(cell.value);
    }
  }
  return values;
}
