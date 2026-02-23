import {
  describe,
  expect,
  it
} from 'vitest';

import {
  evaluateTuple,
  generateSubsets,
  GridBoundaries
} from '../src/combinatorics.ts';
import { Operator } from '../src/Puzzle.ts';

describe('evaluateTuple', () => {
  it('returns null for empty tuple', () => {
    expect(evaluateTuple([], Operator.Plus)).toBeNull();
  });

  it('returns the value for single-element tuple', () => {
    expect(evaluateTuple([5], Operator.Plus)).toBe(5);
  });

  it('evaluates addition', () => {
    expect(evaluateTuple([2, 3], Operator.Plus)).toBe(5);
    expect(evaluateTuple([1, 2, 3], Operator.Plus)).toBe(6);
  });

  it('evaluates subtraction (absolute difference)', () => {
    expect(evaluateTuple([5, 3], Operator.Minus)).toBe(2);
    expect(evaluateTuple([3, 5], Operator.Minus)).toBe(2);
  });

  it('returns null for subtraction with more than 2 elements', () => {
    expect(evaluateTuple([1, 2, 3], Operator.Minus)).toBeNull();
  });

  it('evaluates multiplication', () => {
    expect(evaluateTuple([2, 3], Operator.Times)).toBe(6);
    expect(evaluateTuple([1, 2, 3], Operator.Times)).toBe(6);
  });

  it('evaluates division', () => {
    expect(evaluateTuple([6, 3], Operator.Divide)).toBe(2);
    expect(evaluateTuple([3, 6], Operator.Divide)).toBe(2);
  });

  it('returns null for non-integer division', () => {
    expect(evaluateTuple([5, 3], Operator.Divide)).toBeNull();
  });

  it('returns null for division with more than 2 elements', () => {
    expect(evaluateTuple([1, 2, 3], Operator.Divide)).toBeNull();
  });

  it('returns null for division by zero', () => {
    expect(evaluateTuple([0, 5], Operator.Divide)).toBeNull();
  });

  it('returns null for unknown operator', () => {
    expect(evaluateTuple([1, 2], Operator.Unknown)).toBeNull();
  });
});

describe('generateSubsets', () => {
  it('generates empty subset for k=0', () => {
    expect(generateSubsets([1, 2, 3], 0)).toEqual([[]]);
  });

  it('generates all singletons for k=1', () => {
    expect(generateSubsets([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it('generates all pairs for k=2', () => {
    expect(generateSubsets([1, 2, 3], 2)).toEqual([[1, 2], [1, 3], [2, 3]]);
  });

  it('generates full set for k=n', () => {
    expect(generateSubsets([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });

  it('returns empty array when k > n', () => {
    expect(generateSubsets([1, 2], 3)).toEqual([]);
  });
});

describe('GridBoundaries', () => {
  // 2x2 grid: cage 1 = [A1, A2] (col 1), cage 2 = [B1, B2] (col 2)
  const cages = [
    { cells: ['A1', 'A2'], operator: Operator.Unknown, value: 3 },
    { cells: ['B1', 'B2'], operator: Operator.Unknown, value: 3 }
  ];
  const boundaries = new GridBoundaries(cages, 2);

  it('detects internal vertical boundary between cages', () => {
    expect(boundaries.hasRightBound(1, 1)).toBe(true);
    expect(boundaries.hasLeftBound(1, 2)).toBe(true);
    expect(boundaries.hasRightBound(2, 1)).toBe(true);
    expect(boundaries.hasLeftBound(2, 2)).toBe(true);
  });

  it('detects no internal horizontal boundary within same cage', () => {
    expect(boundaries.hasBottomBound(1, 1)).toBe(false);
    expect(boundaries.hasTopBound(2, 1)).toBe(false);
    expect(boundaries.hasBottomBound(1, 2)).toBe(false);
    expect(boundaries.hasTopBound(2, 2)).toBe(false);
  });

  it('returns true for all outer edges', () => {
    expect(boundaries.hasTopBound(1, 1)).toBe(true);
    expect(boundaries.hasLeftBound(1, 1)).toBe(true);
    expect(boundaries.hasBottomBound(2, 1)).toBe(true);
    expect(boundaries.hasRightBound(1, 2)).toBe(true);
    expect(boundaries.hasBottomBound(2, 2)).toBe(true);
    expect(boundaries.hasRightBound(2, 2)).toBe(true);
  });
});
