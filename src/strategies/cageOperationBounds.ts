import type {
  Cell,
  House
} from '../Puzzle.ts';

import {
  HouseType,
  Operator
} from '../Puzzle.ts';
import { ensureNonNullable } from '../typeGuards.ts';

export enum AggregateType {
  Product = 'product',
  Sum = 'sum'
}

export const BINARY_CELL_COUNT = 2;

export enum BoundType {
  Max = 'max',
  Min = 'min'
}

export interface Bounds {
  readonly max: number;
  readonly min: number;
}

export interface LatinSquareBoundParams {
  readonly aggregateType: AggregateType;
  readonly boundType: BoundType;
  readonly otherCells: readonly Cell[];
  readonly puzzleSize: number;
  readonly targetCell: Cell;
  readonly value: number;
}

interface HouseBoundParams extends LatinSquareBoundParams {
  readonly houseType: HouseType;
}

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

export function computeLatinSquareBound(options: LatinSquareBoundParams): number {
  const rowBound = computeHouseBound({ ...options, houseType: HouseType.Row });
  const colBound = computeHouseBound({ ...options, houseType: HouseType.Column });
  return options.boundType === BoundType.Min ? Math.max(rowBound, colBound) : Math.min(rowBound, colBound);
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
  aggregateType: AggregateType,
  axis: HouseType
): Bounds {
  const groups = new Map<number, number>();
  for (const cell of cells) {
    const houseId = axis === HouseType.Row ? cell.row.id : cell.column.id;
    groups.set(houseId, (groups.get(houseId) ?? 0) + 1);
  }

  let min = aggregateType === AggregateType.Sum ? 0 : 1;
  let max = aggregateType === AggregateType.Sum ? 0 : 1;

  for (const count of groups.values()) {
    const groupMin = distinctAggregateBound(count, puzzleSize, aggregateType, BoundType.Min);
    const groupMax = distinctAggregateBound(count, puzzleSize, aggregateType, BoundType.Max);
    if (aggregateType === AggregateType.Sum) {
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
): Bounds {
  const rowBound = computeAxisBound(cells, puzzleSize, AggregateType.Product, HouseType.Row);
  const colBound = computeAxisBound(cells, puzzleSize, AggregateType.Product, HouseType.Column);
  return {
    max: Math.min(rowBound.max, colBound.max),
    min: Math.max(rowBound.min, colBound.min)
  };
}

function computeCageSumBounds(
  cells: readonly Cell[],
  puzzleSize: number
): Bounds {
  const rowBound = computeAxisBound(cells, puzzleSize, AggregateType.Sum, HouseType.Row);
  const colBound = computeAxisBound(cells, puzzleSize, AggregateType.Sum, HouseType.Column);
  return {
    max: Math.min(rowBound.max, colBound.max),
    min: Math.max(rowBound.min, colBound.min)
  };
}

function computeHouseBound(options: HouseBoundParams): number {
  const { aggregateType, boundType, houseType, otherCells, puzzleSize, targetCell, value } = options;
  const groups = new Map<number, Cell[]>();
  for (const cell of otherCells) {
    const houseId = houseType === HouseType.Row ? cell.row.id : cell.column.id;
    const existing = groups.get(houseId);
    if (existing) {
      existing.push(cell);
    } else {
      groups.set(houseId, [cell]);
    }
  }

  const targetHouseId = houseType === HouseType.Row ? targetCell.row.id : targetCell.column.id;

  let result = aggregateType === AggregateType.Sum ? 0 : 1;

  for (const [houseId, cells] of groups) {
    const house = houseType === HouseType.Row ? ensureNonNullable(cells[0]).row : ensureNonNullable(cells[0]).column;
    const excluded = solvedValuesInHouse(house);
    if (houseId === targetHouseId) {
      excluded.add(value);
    }
    const fn = boundType === BoundType.Min ? minDistinctAggregate : maxDistinctAggregate;
    const groupBound = fn(cells.length, puzzleSize, aggregateType, excluded);
    result = aggregateType === AggregateType.Sum ? result + groupBound : result * groupBound;
  }

  return result;
}

function distinctAggregateBound(
  count: number,
  puzzleSize: number,
  aggregateType: AggregateType,
  boundType: BoundType
): number {
  if (aggregateType === AggregateType.Product) {
    return distinctProductBound(count, puzzleSize, boundType);
  }
  return boundType === BoundType.Min
    ? count * (count + 1) / BINARY_CELL_COUNT
    : count * puzzleSize - count * (count - 1) / BINARY_CELL_COUNT;
}

function distinctProductBound(
  cellCount: number,
  puzzleSize: number,
  boundType: BoundType
): number {
  let result = 1;
  if (boundType === BoundType.Min) {
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
  aggregateType: AggregateType,
  excludedValues: ReadonlySet<number>
): number {
  let result = aggregateType === AggregateType.Sum ? 0 : 1;
  let picked = 0;
  for (let v = puzzleSize; v >= 1 && picked < count; v--) {
    if (!excludedValues.has(v)) {
      result = aggregateType === AggregateType.Sum ? result + v : result * v;
      picked++;
    }
  }
  return result;
}

function minDistinctAggregate(
  count: number,
  puzzleSize: number,
  aggregateType: AggregateType,
  excludedValues: ReadonlySet<number>
): number {
  let result = aggregateType === AggregateType.Sum ? 0 : 1;
  let picked = 0;
  for (let v = 1; v <= puzzleSize && picked < count; v++) {
    if (!excludedValues.has(v)) {
      result = aggregateType === AggregateType.Sum ? result + v : result * v;
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
