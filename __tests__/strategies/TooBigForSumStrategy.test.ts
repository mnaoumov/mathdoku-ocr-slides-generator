import {
  describe,
  expect,
  it
} from 'vitest';

import { CandidatesStrikethrough } from '../../src/cellChanges/CandidatesStrikethrough.ts';
import { Operator } from '../../src/Puzzle.ts';
import { TooBigForSumStrategy } from '../../src/strategies/TooBigForSumStrategy.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import {
  createTestPuzzle,
  fillRemainingCells
} from '../puzzleTestHelper.ts';

describe('TooBigForSumStrategy', () => {
  const strategy = new TooBigForSumStrategy();

  it('eliminates candidates that are too big for the cage sum', () => {
    // Cage 8+ with 3 cells in 6x6: value 6 gives remainder 2,
    // Min distinct sum of 2 cells = 1+2 = 3 > 2 → 6 too big
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: Operator.Plus, value: 8 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const { details } = ensureNonNullable(result);

    expect(details).toContain('-6');
  });

  it('uses latin square bounds for cells in the same row', () => {
    // Cage 8+ with 3 cells: A1, B1 (row 1), A2 (row 2)
    // A2 checking V=6: remainder = 8-6 = 2, min sum of A1+B1 (same row, distinct, excl 6) = 1+2 = 3 > 2 → too big
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: Operator.Plus, value: 8 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const changes = ensureNonNullable(result).changeGroups.flatMap((g) => g.changes);

    const a2Strikethroughs = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'A2'
    ) as CandidatesStrikethrough[];
    const a2EliminatedValues = a2Strikethroughs.flatMap((c) => [...c.values]);
    expect(a2EliminatedValues).toContain(6);
  });

  it('returns null when no candidates are too big', () => {
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
