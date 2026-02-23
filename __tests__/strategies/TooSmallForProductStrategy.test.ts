import {
  describe,
  expect,
  it
} from 'vitest';

import { CandidatesStrikethrough } from '../../src/cellChanges/CandidatesStrikethrough.ts';
import { Operator } from '../../src/Puzzle.ts';
import { TooSmallForProductStrategy } from '../../src/strategies/TooSmallForProductStrategy.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import {
  createTestPuzzle,
  fillRemainingCells
} from '../puzzleTestHelper.ts';

describe('TooSmallForProductStrategy', () => {
  const strategy = new TooSmallForProductStrategy();

  it('eliminates candidates with unachievable quotient', () => {
    // Cage 72x with 3 cells in 6x6: values 1,2 divide 72 but quotients (72,36)
    // Exceed max product of 2 remaining cells (5×6=30) → too small
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: Operator.Times, value: 72 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const { details } = ensureNonNullable(result);

    expect(details).toContain('-1');
    expect(details).toContain('-2');
  });

  it('returns null when quotients are within range', () => {
    // Cage 6x with 2 cells in 6x6: value 2 → quotient 3 ≤ 6, value 3 → quotient 2 ≤ 6
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Times, value: 6 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    puzzle.getCell('A1').setCandidates([1, 2, 3, 6]);
    puzzle.getCell('B1').setCandidates([1, 2, 3, 6]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('returns null for addition cages', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 8 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('skips candidates that do not divide the cage value', () => {
    // Cage 20x: value 3 doesn't divide 20, so TooSmallForProduct should NOT claim it
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: Operator.Times, value: 20 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    const result = strategy.tryApply(puzzle);
    if (result) {
      const changes = result.changeGroups.flatMap((g) => g.changes);
      for (const change of changes) {
        if (change instanceof CandidatesStrikethrough) {
          expect([...change.values]).not.toContain(3);
          expect([...change.values]).not.toContain(6);
        }
      }
    }
  });
});
