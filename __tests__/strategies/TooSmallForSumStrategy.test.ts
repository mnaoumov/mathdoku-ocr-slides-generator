import {
  describe,
  expect,
  it
} from 'vitest';

import { CandidatesStrikethrough } from '../../src/cellChanges/CandidatesStrikethrough.ts';
import { Operator } from '../../src/Puzzle.ts';
import { TooSmallForSumStrategy } from '../../src/strategies/TooSmallForSumStrategy.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import {
  createTestPuzzle,
  fillRemainingCells
} from '../puzzleTestHelper.ts';

describe('TooSmallForSumStrategy', () => {
  const strategy = new TooSmallForSumStrategy();

  it('eliminates candidates that are too small for the cage sum', () => {
    // Cage 13+ with 3 cells in 6x6: value 1 gives remainder 12,
    // Max distinct sum of 2 cells = 5+6 = 11 < 12 → 1 too small
    const cages = fillRemainingCells([
      { cells: ['C1', 'D1', 'D2'], operator: Operator.Plus, value: 13 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const { details } = ensureNonNullable(result);

    expect(details).toContain('-1');
  });

  it('uses latin square bounds for cells in the same row', () => {
    // Cage 8+ with 3 cells: A1, B1 (both in row 1), A2 (in row 2)
    // For A2 checking V=6: remainder = 8-6 = 2, but A1 and B1 are in the same row,
    // Min sum = 1+2 = 3 > 2 → 6 too small... wait, remainder < min → too big, not too small
    // Actually for TooSmall: remainder > maxOtherSum. V=1: remainder=7, maxOtherSum≤5+6=11 → 7<11 → not too small
    // This strategy shouldn't fire for the 8+ cage — use 16+ instead
    // Cage 4+ with 3 cells: V=1: remainder=3, maxOtherSum for 2 cells in same row excl 1 = 2+...
    // Actually let's test a clearer case
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: Operator.Plus, value: 16 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const changes = ensureNonNullable(result).changeGroups.flatMap((g) => g.changes);

    // A2 checking V=1: remainder = 16-1 = 15, A1+B1 max (same row, distinct, excl 1) = 5+6 = 11 < 15 → too small
    const a2Strikethroughs = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'A2'
    ) as CandidatesStrikethrough[];
    const a2EliminatedValues = a2Strikethroughs.flatMap((c) => [...c.values]);
    expect(a2EliminatedValues).toContain(1);
  });

  it('returns null when no candidates are too small', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 }
    ], 2);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 2 });
    puzzle.getCell('A1').setCandidates([1, 2]);
    puzzle.getCell('B1').setCandidates([1, 2]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('returns null for multiplication cages', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Times, value: 6 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    expect(strategy.tryApply(puzzle)).toBeNull();
  });
});
