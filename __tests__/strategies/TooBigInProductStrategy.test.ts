import {
  describe,
  expect,
  it
} from 'vitest';

import { TooBigInProductStrategy } from '../../src/strategies/TooBigInProductStrategy.ts';
import {
  createTestPuzzle,
  fillRemainingCells
} from '../puzzleTestHelper.ts';

describe('TooBigInProductStrategy', () => {
  const strategy = new TooBigInProductStrategy();

  it('returns null for binary multiplication cages (never fires for 2-cell)', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: 'x', value: 6 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('returns null for addition cages', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: '+', value: 8 }
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
      { cells: ['A1', 'B1', 'A2'], operator: 'x', value: 30 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 5, 6]);
    }

    expect(strategy.tryApply(puzzle)).toBeNull();
  });
});
