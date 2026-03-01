import {
  describe,
  expect,
  it
} from 'vitest';

import { CandidatesStrikethrough } from '../../src/cellChanges/CandidatesStrikethrough.ts';
import { XWingStrategy } from '../../src/strategies/XWingStrategy.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import {
  createTestPuzzle,
  fillRemainingCells
} from '../puzzleTestHelper.ts';

describe('XWingStrategy', () => {
  const strategy = new XWingStrategy();

  it('finds column-based X-Wing and eliminates from rows', () => {
    // 5x5 puzzle. Candidate 3 appears in exactly 2 cells in column A (rows 1,3)
    // And exactly 2 cells in column C (rows 1,3).
    // Eliminate 3 from other cells in rows 1 and 3
    const cages = fillRemainingCells([], 5);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 5 });

    // Column A: candidate 3 only in A1,A3
    puzzle.getCell('A1').setCandidates([1, 3]);
    puzzle.getCell('A2').setCandidates([2, 4, 5]);
    puzzle.getCell('A3').setCandidates([1, 3]);
    puzzle.getCell('A4').setCandidates([2, 4, 5]);
    puzzle.getCell('A5').setCandidates([2, 4, 5]);

    // Column C: candidate 3 only in C1,C3
    puzzle.getCell('C1').setCandidates([2, 3]);
    puzzle.getCell('C2').setCandidates([1, 4, 5]);
    puzzle.getCell('C3').setCandidates([2, 3]);
    puzzle.getCell('C4').setCandidates([1, 4, 5]);
    puzzle.getCell('C5').setCandidates([1, 4, 5]);

    // Row 1 & 3 targets: B,D have candidate 3; E doesn't
    puzzle.getCell('B1').setCandidates([1, 3, 5]);
    puzzle.getCell('D1').setCandidates([2, 3, 4]);
    puzzle.getCell('E1').setCandidates([4, 5]);
    puzzle.getCell('B3').setCandidates([1, 3, 5]);
    puzzle.getCell('D3').setCandidates([2, 3, 4]);
    puzzle.getCell('E3').setCandidates([4, 5]);

    // Fill other cells without candidate 3
    puzzle.getCell('B2').setCandidates([1, 2, 5]);
    puzzle.getCell('B4').setCandidates([1, 2, 4]);
    puzzle.getCell('B5').setCandidates([1, 2, 4]);
    puzzle.getCell('D2').setCandidates([1, 2, 5]);
    puzzle.getCell('D4').setCandidates([1, 2, 5]);
    puzzle.getCell('D5').setCandidates([1, 2, 5]);
    puzzle.getCell('E2').setCandidates([1, 2]);
    puzzle.getCell('E4').setCandidates([1, 2]);
    puzzle.getCell('E5').setCandidates([1, 2]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const r = ensureNonNullable(result);

    // Find the change group for value 3 X-Wing on columns A,C
    const matchingGroup = r.changeGroups.find(
      (g) => g.reason.includes('3') && g.reason.includes('columns (AC)')
    );
    expect(matchingGroup).toBeDefined();

    const changes = ensureNonNullable(matchingGroup).changes as CandidatesStrikethrough[];
    const affectedCells = changes.map((c) => c.cell.ref).sort();
    expect(affectedCells).toEqual(['B1', 'B3', 'D1', 'D3']);
    for (const change of changes) {
      expect(change.values).toEqual([3]);
    }
  });

  it('finds row-based X-Wing and eliminates from columns', () => {
    // 5x5 puzzle. Candidate 2 in row 1 only at columns A,C
    // And in row 3 only at columns A,C.
    // Eliminate 2 from other cells in columns A,C
    const cages = fillRemainingCells([], 5);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 5 });

    // Row 1: candidate 2 only in A1,C1
    puzzle.getCell('A1').setCandidates([1, 2]);
    puzzle.getCell('B1').setCandidates([1, 3, 4]);
    puzzle.getCell('C1').setCandidates([3, 2]);
    puzzle.getCell('D1').setCandidates([4, 5]);
    puzzle.getCell('E1').setCandidates([3, 5]);

    // Row 3: candidate 2 only in A3,C3
    puzzle.getCell('A3').setCandidates([1, 2]);
    puzzle.getCell('B3').setCandidates([1, 3, 4]);
    puzzle.getCell('C3').setCandidates([3, 2]);
    puzzle.getCell('D3').setCandidates([4, 5]);
    puzzle.getCell('E3').setCandidates([3, 5]);

    // Columns A,C in other rows: have candidate 2 (these should be eliminated)
    puzzle.getCell('A2').setCandidates([2, 3, 5]);
    puzzle.getCell('A4').setCandidates([2, 3, 5]);
    puzzle.getCell('A5').setCandidates([3, 4, 5]);
    puzzle.getCell('C2').setCandidates([1, 2, 4]);
    puzzle.getCell('C4').setCandidates([1, 2, 4]);
    puzzle.getCell('C5').setCandidates([1, 4, 5]);

    // Fill remaining cells
    puzzle.getCell('B2').setCandidates([1, 4, 5]);
    puzzle.getCell('B4').setCandidates([1, 4, 5]);
    puzzle.getCell('B5').setCandidates([1, 4, 5]);
    puzzle.getCell('D2').setCandidates([1, 3, 5]);
    puzzle.getCell('D4').setCandidates([1, 3, 5]);
    puzzle.getCell('D5').setCandidates([1, 3]);
    puzzle.getCell('E2').setCandidates([1, 4]);
    puzzle.getCell('E4').setCandidates([1, 4]);
    puzzle.getCell('E5').setCandidates([1, 4]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const r = ensureNonNullable(result);

    // Find the change group for value 2 X-Wing on rows 1,3
    const matchingGroup = r.changeGroups.find(
      (g) => g.reason.includes('2') && g.reason.includes('rows (13)')
    );
    expect(matchingGroup).toBeDefined();

    const changes = ensureNonNullable(matchingGroup).changes as CandidatesStrikethrough[];
    const affectedCells = changes.map((c) => c.cell.ref).sort();
    expect(affectedCells).toEqual(['A2', 'A4', 'C2', 'C4']);
    for (const change of changes) {
      expect(change.values).toEqual([2]);
    }
  });

  it('returns null when positions do not align', () => {
    // Most cells solved, only 4 unsolved cells with candidate 3
    // Col A has 3 in rows 1,3; Col C has 3 in rows 2,4 → rows don't match
    // No other X-Wing patterns because most cells are solved
    const cages = fillRemainingCells([], 5);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 5 });

    // Solve most cells
    for (let row = 1; row <= 5; row++) {
      for (const col of ['A', 'B', 'C', 'D', 'E']) {
        puzzle.getCell(`${col}${String(row)}`).setValue(row);
      }
    }

    // Unsolved cells with candidate 3 in non-aligned positions
    puzzle.getCell('A1').clearValue();
    puzzle.getCell('A1').setCandidates([1, 3]);
    puzzle.getCell('A3').clearValue();
    puzzle.getCell('A3').setCandidates([1, 3]);
    puzzle.getCell('C2').clearValue();
    puzzle.getCell('C2').setCandidates([2, 3]);
    puzzle.getCell('C4').clearValue();
    puzzle.getCell('C4').setCandidates([2, 3]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('returns null when candidate appears in more than 2 cells in a line', () => {
    // Col A has candidate 3 in rows 1,2,3 (3 cells) → not exactly 2
    // Only 3 unsolved cells, all in same column → no X-Wing possible
    const cages = fillRemainingCells([], 5);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 5 });

    // Solve most cells
    for (let row = 1; row <= 5; row++) {
      for (const col of ['A', 'B', 'C', 'D', 'E']) {
        puzzle.getCell(`${col}${String(row)}`).setValue(row);
      }
    }

    // Unsolved: A1, A2, A3 all with candidate 3
    puzzle.getCell('A1').clearValue();
    puzzle.getCell('A1').setCandidates([1, 3]);
    puzzle.getCell('A2').clearValue();
    puzzle.getCell('A2').setCandidates([2, 3]);
    puzzle.getCell('A3').clearValue();
    puzzle.getCell('A3').setCandidates([1, 3]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('returns null when cross-line cells already lack the candidate', () => {
    // X-Wing pattern for 3 in cols A,C rows 1,3 exists
    // But all other cells in rows 1,3 are solved — nothing to eliminate
    const cages = fillRemainingCells([], 5);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 5 });

    // Solve all cells first
    for (let row = 1; row <= 5; row++) {
      for (const col of ['A', 'B', 'C', 'D', 'E']) {
        puzzle.getCell(`${col}${String(row)}`).setValue(row);
      }
    }

    // Unsolved: only the X-Wing corner cells
    puzzle.getCell('A1').clearValue();
    puzzle.getCell('A1').setCandidates([1, 3]);
    puzzle.getCell('A3').clearValue();
    puzzle.getCell('A3').setCandidates([1, 3]);
    puzzle.getCell('C1').clearValue();
    puzzle.getCell('C1').setCandidates([2, 3]);
    puzzle.getCell('C3').clearValue();
    puzzle.getCell('C3').setCandidates([2, 3]);

    // All other cells in rows 1,3 are still solved → no eliminations
    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('includes correct reason format for column-based X-Wing', () => {
    const cages = fillRemainingCells([], 5);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 5 });

    puzzle.getCell('A1').setCandidates([1, 3]);
    puzzle.getCell('A2').setCandidates([2, 4, 5]);
    puzzle.getCell('A3').setCandidates([1, 3]);
    puzzle.getCell('A4').setCandidates([2, 4, 5]);
    puzzle.getCell('A5').setCandidates([2, 4, 5]);

    puzzle.getCell('C1').setCandidates([2, 3]);
    puzzle.getCell('C2').setCandidates([1, 4, 5]);
    puzzle.getCell('C3').setCandidates([2, 3]);
    puzzle.getCell('C4').setCandidates([1, 4, 5]);
    puzzle.getCell('C5').setCandidates([1, 4, 5]);

    puzzle.getCell('B1').setCandidates([1, 3, 5]);
    puzzle.getCell('B2').setCandidates([1, 2, 5]);
    puzzle.getCell('B3').setCandidates([1, 3, 5]);
    puzzle.getCell('B4').setCandidates([1, 2, 5]);
    puzzle.getCell('B5').setCandidates([1, 2, 5]);
    puzzle.getCell('D1').setCandidates([2, 3, 4]);
    puzzle.getCell('D2').setCandidates([1, 2, 5]);
    puzzle.getCell('D3').setCandidates([2, 3, 4]);
    puzzle.getCell('D4').setCandidates([1, 2, 5]);
    puzzle.getCell('D5').setCandidates([1, 2, 5]);
    puzzle.getCell('E1').setCandidates([4, 5]);
    puzzle.getCell('E2').setCandidates([1, 2]);
    puzzle.getCell('E3').setCandidates([4, 5]);
    puzzle.getCell('E4').setCandidates([1, 2]);
    puzzle.getCell('E5').setCandidates([1, 2]);

    const result = ensureNonNullable(strategy.tryApply(puzzle));
    const reasons = result.changeGroups.map((g) => g.reason);
    expect(reasons).toContain('3 columns (AC) rows (13)');

    expect(result.details).toBeDefined();
    expect(ensureNonNullable(result.details)).toContain('3 columns (AC) rows (13)');
  });
});
