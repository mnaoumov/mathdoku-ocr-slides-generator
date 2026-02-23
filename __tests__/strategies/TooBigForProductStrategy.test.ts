import {
  describe,
  expect,
  it
} from 'vitest';

import { Operator } from '../../src/Puzzle.ts';
import { TooBigForProductStrategy } from '../../src/strategies/TooBigForProductStrategy.ts';
import {
  createTestPuzzle,
  fillRemainingCells
} from '../puzzleTestHelper.ts';

describe('TooBigForProductStrategy', () => {
  const strategy = new TooBigForProductStrategy();

  it('returns null for binary multiplication cages (never fires for 2-cell)', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Times, value: 6 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('returns null for addition cages', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: Operator.Plus, value: 8 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('returns null when no candidates have quotients below min product', () => {
    // Cage 30x with 3 cells in 6x6: all quotients are within achievable range
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: Operator.Times, value: 30 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 5, 6]);
    }

    expect(strategy.tryApply(puzzle)).toBeNull();
  });
});
