import {
  describe,
  expect,
  it
} from 'vitest';

import { CandidatesStrikethrough } from '../../src/cellChanges/CandidatesStrikethrough.ts';
import { DoesNotDivideProductStrategy } from '../../src/strategies/DoesNotDivideProductStrategy.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import {
  createTestPuzzle,
  fillRemainingCells
} from '../puzzleTestHelper.ts';

describe('DoesNotDivideProductStrategy', () => {
  const strategy = new DoesNotDivideProductStrategy();

  it('eliminates candidates that do not divide the cage value', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: 'x', value: 20 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const r = ensureNonNullable(result);
    const changes = r.changeGroups.flatMap((g) => g.changes);

    const a1Eliminations = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'A1'
    ) as CandidatesStrikethrough[];
    const eliminatedValues = a1Eliminations.flatMap((c) => [...c.values]);
    expect(eliminatedValues).toContain(3);
    expect(eliminatedValues).toContain(6);
    expect(eliminatedValues).not.toContain(1);
    expect(eliminatedValues).not.toContain(2);
    expect(eliminatedValues).not.toContain(4);
    expect(eliminatedValues).not.toContain(5);
  });

  it('uses set notation for multiple eliminated values', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: 'x', value: 20 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const { note } = ensureNonNullable(result);

    expect(note).toContain('{36} don\'t divide 20');
  });

  it('deduplicates eliminated values across cells in the same cage', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: 'x', value: 20 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const { note } = ensureNonNullable(result);

    const matches = note.match(/doesn't divide|don't divide/g);
    expect(ensureNonNullable(matches).length).toBe(1);
  });

  it('includes note prefix and cage ref', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: 'x', value: 20 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const { note } = ensureNonNullable(result);

    expect(note).toContain('Doesn\'t divide product.');
    expect(note).toContain('@A1:');
  });

  it('returns null for addition cages', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: '+', value: 3 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('returns null when all candidates divide the cage value', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: 'x', value: 6 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    puzzle.getCell('A1').setCandidates([1, 2, 3, 6]);
    puzzle.getCell('B1').setCandidates([1, 2, 3, 6]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });
});
