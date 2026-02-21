import {
  describe,
  expect,
  it
} from 'vitest';

import { CandidatesStrikethrough } from '../../src/cellChanges/CandidatesStrikethrough.ts';
import { EliminateByOperationStrategy } from '../../src/strategies/EliminateByOperationStrategy.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import {
  createTestPuzzle,
  fillRemainingCells
} from '../puzzleTestHelper.ts';

describe('EliminateByOperationStrategy', () => {
  const strategy = new EliminateByOperationStrategy();

  it('eliminates candidates that do not divide the cage value for multiplication', () => {
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
    );
    expect(a1Eliminations.length).toBeGreaterThan(0);
    expect(r.note).toContain('Cage operation.');
    expect(r.note).toContain('@A1:');
  });

  it('deduplicates eliminated values across cells in the same cage', () => {
    // 3-cell multiplication cage: values 3 and 6 don't divide 20
    // All 3 cells have {1,2,3,4,5,6} — should produce ONE "{36} don't divide 20" not repeated per cell
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

    // Should NOT repeat "3 doesn't divide 20" multiple times
    const matches = note.match(/doesn't divide|don't divide/g);
    expect(ensureNonNullable(matches).length).toBe(1);
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

    // Concatenated digits in set notation: {36} don't divide 20
    expect(note).toContain('{36} don\'t divide 20');
  });

  it('eliminates candidates using latin square bounds for addition', () => {
    // Cage 8+ with 3 cells: A1, B1 (both in row 1), A2 (in row 2)
    // All cells have candidates {1..6}
    // For A2 checking V=6: remainder = 8-6 = 2, but A1 and B1 are in the same row,
    // So they need distinct values, min sum = 1+2 = 3 > 2 → 6 eliminated from A2
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: '+', value: 8 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const changes = ensureNonNullable(result).changeGroups.flatMap((g) => g.changes);

    // A2 should have 6 eliminated (latin square constraint on row 1 cells)
    const a2Strikethroughs = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'A2'
    ) as CandidatesStrikethrough[];
    const a2EliminatedValues = a2Strikethroughs.flatMap((c) => [...c.values]);
    expect(a2EliminatedValues).toContain(6);
  });

  it('classifies multiplication values with unachievable quotient as too small', () => {
    // Cage 72x with 3 cells in 6x6: values 1,2 divide 72 but quotients (72,36)
    // Exceed max product of 2 remaining cells (5×6=30) → "too small"
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: 'x', value: 72 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const { note } = ensureNonNullable(result);

    expect(note).toContain('{12} too small');
    expect(note).not.toContain('impossible');
  });

  it('classifies addition values exceeding distinct sum bound as too small', () => {
    // Cage 13+ with 3 cells in 6x6: value 1 gives remainder 12,
    // Max distinct sum of 2 cells = 5+6 = 11 < 12 → "too small"
    const cages = fillRemainingCells([
      { cells: ['C1', 'D1', 'D2'], operator: '+', value: 13 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const { note } = ensureNonNullable(result);

    expect(note).toContain('1 too small');
    expect(note).not.toContain('too big');
  });

  it('classifies addition values below minimum sum bound as too big', () => {
    // Cage 8+ with 3 cells in 6x6: value 6 gives remainder 2,
    // Min distinct sum of 2 cells = 1+2 = 3 > 2 → "too big"
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: '+', value: 8 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const { note } = ensureNonNullable(result);

    expect(note).toContain('6 too big');
  });

  it('returns null when no candidates can be eliminated', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: '+', value: 3 }
    ], 2);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 2 });
    puzzle.getCell('A1').setCandidates([1, 2]);
    puzzle.getCell('B1').setCandidates([1, 2]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });
});
