import {
  describe,
  expect,
  it
} from 'vitest';

import { CandidatesStrikethrough } from '../../src/cellChanges/CandidatesStrikethrough.ts';
import { FishStrategy } from '../../src/strategies/FishStrategy.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import {
  createTestPuzzle,
  fillRemainingCells
} from '../puzzleTestHelper.ts';

const XWING_SIZE = 2;
const SWORDFISH_SIZE = 3;

describe('FishStrategy', () => {
  describe('X-Wing (size 2)', () => {
    const strategy = new FishStrategy(XWING_SIZE);

    it('has correct name', () => {
      expect(strategy.name).toBe('X-Wing');
    });

    it('finds column-based X-Wing and eliminates from rows', () => {
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
      puzzle.getCell('D1').setCandidates([2, 3, 4]);
      puzzle.getCell('E1').setCandidates([4, 5]);
      puzzle.getCell('B3').setCandidates([1, 3, 5]);
      puzzle.getCell('D3').setCandidates([2, 3, 4]);
      puzzle.getCell('E3').setCandidates([4, 5]);

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
      const cages = fillRemainingCells([], 5);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 5 });

      puzzle.getCell('A1').setCandidates([1, 2]);
      puzzle.getCell('B1').setCandidates([1, 3, 4]);
      puzzle.getCell('C1').setCandidates([3, 2]);
      puzzle.getCell('D1').setCandidates([4, 5]);
      puzzle.getCell('E1').setCandidates([3, 5]);

      puzzle.getCell('A3').setCandidates([1, 2]);
      puzzle.getCell('B3').setCandidates([1, 3, 4]);
      puzzle.getCell('C3').setCandidates([3, 2]);
      puzzle.getCell('D3').setCandidates([4, 5]);
      puzzle.getCell('E3').setCandidates([3, 5]);

      puzzle.getCell('A2').setCandidates([2, 3, 5]);
      puzzle.getCell('A4').setCandidates([2, 3, 5]);
      puzzle.getCell('A5').setCandidates([3, 4, 5]);
      puzzle.getCell('C2').setCandidates([1, 2, 4]);
      puzzle.getCell('C4').setCandidates([1, 2, 4]);
      puzzle.getCell('C5').setCandidates([1, 4, 5]);

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

    it('returns null when no pair has matching cross-line union', () => {
      // Candidate 3 appears in 3+ cells in every row and column,
      // so no defining line has at most 2 candidate cells → no X-Wing
      const cages = fillRemainingCells([], 5);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 5 });

      // Every cell has candidate 3 → every row/column has 5 cells with 3 → no X-Wing
      for (let row = 1; row <= 5; row++) {
        for (const col of ['A', 'B', 'C', 'D', 'E']) {
          puzzle.getCell(`${col}${String(row)}`).setCandidates([1, 2, 3, 4, 5]);
        }
      }

      expect(strategy.tryApply(puzzle)).toBeNull();
    });

    it('returns null when candidate appears in more than 2 cells in a line', () => {
      const cages = fillRemainingCells([], 5);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 5 });

      for (let row = 1; row <= 5; row++) {
        for (const col of ['A', 'B', 'C', 'D', 'E']) {
          puzzle.getCell(`${col}${String(row)}`).setValue(row);
        }
      }

      puzzle.getCell('A1').clearValue();
      puzzle.getCell('A1').setCandidates([1, 3]);
      puzzle.getCell('A2').clearValue();
      puzzle.getCell('A2').setCandidates([2, 3]);
      puzzle.getCell('A3').clearValue();
      puzzle.getCell('A3').setCandidates([1, 3]);

      expect(strategy.tryApply(puzzle)).toBeNull();
    });

    it('returns null when cross-line cells already lack the candidate', () => {
      const cages = fillRemainingCells([], 5);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 5 });

      for (let row = 1; row <= 5; row++) {
        for (const col of ['A', 'B', 'C', 'D', 'E']) {
          puzzle.getCell(`${col}${String(row)}`).setValue(row);
        }
      }

      puzzle.getCell('A1').clearValue();
      puzzle.getCell('A1').setCandidates([1, 3]);
      puzzle.getCell('A3').clearValue();
      puzzle.getCell('A3').setCandidates([1, 3]);
      puzzle.getCell('C1').clearValue();
      puzzle.getCell('C1').setCandidates([2, 3]);
      puzzle.getCell('C3').clearValue();
      puzzle.getCell('C3').setCandidates([2, 3]);

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

  describe('Swordfish (size 3)', () => {
    const strategy = new FishStrategy(SWORDFISH_SIZE);

    it('has correct name', () => {
      expect(strategy.name).toBe('Swordfish');
    });

    it('finds Swordfish pattern and eliminates from cross-lines', () => {
      // 6x6 puzzle. Candidate 1 appears in at most 3 cells in each of 3 rows,
      // and the union of columns is exactly 3.
      // Row 1: 1 in columns A, C
      // Row 3: 1 in columns A, E
      // Row 5: 1 in columns C, E
      // Union of columns: {A, C, E} = 3 → Swordfish on rows 1,3,5 / columns A,C,E
      // Eliminate 1 from other cells in columns A, C, E
      const cages = fillRemainingCells([], 6);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });

      // Set all cells with some candidates first
      for (let row = 1; row <= 6; row++) {
        for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
          puzzle.getCell(`${col}${String(row)}`).setCandidates([2, 3, 4, 5, 6]);
        }
      }

      // Row 1: 1 only in A1, C1
      puzzle.getCell('A1').setCandidates([1, 2]);
      puzzle.getCell('C1').setCandidates([1, 3]);

      // Row 3: 1 only in A3, E3
      puzzle.getCell('A3').setCandidates([1, 4]);
      puzzle.getCell('E3').setCandidates([1, 5]);

      // Row 5: 1 only in C5, E5
      puzzle.getCell('C5').setCandidates([1, 6]);
      puzzle.getCell('E5').setCandidates([1, 2]);

      // Columns A, C, E: other rows should have candidate 1 for eliminations
      puzzle.getCell('A2').setCandidates([1, 3, 4]);
      puzzle.getCell('A4').setCandidates([1, 3, 5]);
      puzzle.getCell('A6').setCandidates([1, 4, 6]);
      puzzle.getCell('C2').setCandidates([1, 2, 5]);
      puzzle.getCell('C4').setCandidates([1, 3, 6]);
      puzzle.getCell('C6').setCandidates([1, 5, 6]);
      puzzle.getCell('E2').setCandidates([1, 2, 4]);
      puzzle.getCell('E4').setCandidates([1, 4, 6]);
      puzzle.getCell('E6').setCandidates([1, 3, 5]);

      const result = strategy.tryApply(puzzle);
      expect(result).not.toBeNull();
      const r = ensureNonNullable(result);

      const matchingGroup = r.changeGroups.find(
        (g) => g.reason.includes('1') && g.reason.includes('rows (135)') && g.reason.includes('columns (ACE)')
      );
      expect(matchingGroup).toBeDefined();

      const changes = ensureNonNullable(matchingGroup).changes as CandidatesStrikethrough[];
      // Should eliminate 1 from A2, A4, A6, C2, C4, C6, E2, E4, E6
      const affectedCells = changes.map((c) => c.cell.ref).sort();
      expect(affectedCells).toEqual(['A2', 'A4', 'A6', 'C2', 'C4', 'C6', 'E2', 'E4', 'E6']);
      for (const change of changes) {
        expect(change.values).toEqual([1]);
      }
    });

    it('returns null when candidate appears in 4+ cells in every line', () => {
      // 6x6 puzzle where candidate 1 appears in 4+ cells in every row and column
      // → every line has > 3 candidate cells → no Swordfish possible
      const cages = fillRemainingCells([], 6);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });

      for (let row = 1; row <= 6; row++) {
        for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
          puzzle.getCell(`${col}${String(row)}`).setCandidates([1, 2, 3, 4, 5, 6]);
        }
      }

      expect(strategy.tryApply(puzzle)).toBeNull();
    });
  });
});
