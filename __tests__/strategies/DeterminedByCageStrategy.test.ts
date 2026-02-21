import {
  describe,
  expect,
  it
} from 'vitest';

import { ValueChange } from '../../src/cellChanges/ValueChange.ts';
import { DeterminedByCageStrategy } from '../../src/strategies/DeterminedByCageStrategy.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import {
  createTestPuzzle,
  fillRemainingCells
} from '../puzzleTestHelper.ts';

describe('DeterminedByCageStrategy', () => {
  const strategy = new DeterminedByCageStrategy();

  it('determines cell value when other cells form a naked pair in the same row', () => {
    // Cage 72x with 3 cells: A1 (row 1), A2, B2 (both in row 2)
    // A2 and B2 have candidates {4, 6} — naked pair in row 2
    // A1 must be 72 / (4*6) = 3
    const cages = fillRemainingCells([
      { cells: ['A1', 'A2', 'B2'], operator: 'x', value: 72 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    puzzle.getCell('A1').setCandidates([3, 4, 6]);
    puzzle.getCell('A2').setCandidates([4, 6]);
    puzzle.getCell('B2').setCandidates([4, 6]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const r = ensureNonNullable(result);
    const changes = r.changeGroups.flatMap((g) => g.changes);

    const valueChanges = changes.filter((c) => c instanceof ValueChange);
    expect(valueChanges.some((c) => c.cell.ref === 'A1' && c.value === 3)).toBe(true);
    expect(r.note).toBe('Determined by cage. A1');
  });

  it('determines cell value with addition operator', () => {
    // Cage 10+ with 3 cells: A1, A2, B2
    // A2 and B2 have candidates {3, 4} — naked pair in row 2, sum = 7
    // A1 must be 10 - 7 = 3
    const cages = fillRemainingCells([
      { cells: ['A1', 'A2', 'B2'], operator: '+', value: 10 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    puzzle.getCell('A1').setCandidates([1, 2, 3, 4, 5, 6]);
    puzzle.getCell('A2').setCandidates([3, 4]);
    puzzle.getCell('B2').setCandidates([3, 4]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const changes = ensureNonNullable(result).changeGroups.flatMap((g) => g.changes);

    const valueChanges = changes.filter((c) => c instanceof ValueChange);
    expect(valueChanges.some((c) => c.cell.ref === 'A1' && c.value === 3)).toBe(true);
  });

  it('handles union of naked sets across different houses', () => {
    // Cage 120x with 5 cells: A1 (target), A2, B2, A3, B3
    // A2, B2 in row 2: candidates {1, 2} — naked pair, product = 2
    // A3, B3 in row 3: candidates {3, 4} — naked pair, product = 12
    // A1 = 120 / (2 * 12) = 5
    const cages = fillRemainingCells([
      { cells: ['A1', 'A2', 'B2', 'A3', 'B3'], operator: 'x', value: 120 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    puzzle.getCell('A1').setCandidates([1, 2, 3, 4, 5, 6]);
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B2').setCandidates([1, 2]);
    puzzle.getCell('A3').setCandidates([3, 4]);
    puzzle.getCell('B3').setCandidates([3, 4]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const changes = ensureNonNullable(result).changeGroups.flatMap((g) => g.changes);

    const valueChanges = changes.filter((c) => c instanceof ValueChange);
    expect(valueChanges.some((c) => c.cell.ref === 'A1' && c.value === 5)).toBe(true);
  });

  it('returns null when other cells cannot be partitioned into naked sets', () => {
    // No naked set: A2 and B2 have different-sized candidate sets
    const cages = fillRemainingCells([
      { cells: ['A1', 'A2', 'B2'], operator: 'x', value: 72 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    puzzle.getCell('A1').setCandidates([3, 4, 6]);
    puzzle.getCell('A2').setCandidates([4, 5, 6]);
    puzzle.getCell('B2').setCandidates([4, 6]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('returns null when target value is not in candidates', () => {
    // A1 = 72 / (4*6) = 3, but A1 doesn't have candidate 3
    const cages = fillRemainingCells([
      { cells: ['A1', 'A2', 'B2'], operator: 'x', value: 72 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    puzzle.getCell('A1').setCandidates([4, 6]);
    puzzle.getCell('A2').setCandidates([4, 6]);
    puzzle.getCell('B2').setCandidates([4, 6]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('skips subtraction and division operators', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: '-', value: 1 }
    ], 4);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setCandidates([1, 2]);
    puzzle.getCell('B1').setCandidates([1, 2]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });
});
