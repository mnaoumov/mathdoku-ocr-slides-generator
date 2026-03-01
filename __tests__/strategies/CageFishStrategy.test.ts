import {
  describe,
  expect,
  it
} from 'vitest';

import { CandidatesStrikethrough } from '../../src/cellChanges/CandidatesStrikethrough.ts';
import { Operator } from '../../src/Puzzle.ts';
import { CageFishStrategy } from '../../src/strategies/CageFishStrategy.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import {
  createTestPuzzle,
  fillRemainingCells
} from '../puzzleTestHelper.ts';

const CAGE_X_WING_SIZE = 2;

describe('CageFishStrategy', () => {
  describe('Cage X-Wing (size 2)', () => {
    const strategy = new CageFishStrategy(CAGE_X_WING_SIZE);

    it('has correct name', () => {
      expect(strategy.name).toBe('Cage X-Wing');
    });

    it('finds row-based Cage X-Wing and eliminates from rows', () => {
      // 6x6 puzzle with two L-shaped cages each requiring value 1
      // Cage @B2: B2,B3 (value 3+) — tuples: (1,2),(2,1) → 1 required
      //   1-candidates in rows {2,3}
      // Cage @F2: F2,F3 (value 3+) — tuples: (1,2),(2,1) → 1 required
      //   1-candidates in rows {2,3}
      // Both cages' 1-positions confined to rows {2,3} → Cage X-Wing
      // Eliminate 1 from A2, A3 (non-cage cells in rows 2,3 with candidate 1)
      const cages = fillRemainingCells([
        { cells: ['B2', 'B3'], operator: Operator.Plus, value: 3 },
        { cells: ['F2', 'F3'], operator: Operator.Plus, value: 3 }
      ], 6);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });

      // Set candidates: B2,B3,F2,F3 have {1,2} so tuples (1,2),(2,1) → 1 required
      puzzle.getCell('B2').setCandidates([1, 2]);
      puzzle.getCell('B3').setCandidates([1, 2]);
      puzzle.getCell('F2').setCandidates([1, 2]);
      puzzle.getCell('F3').setCandidates([1, 2]);

      // Non-cage cells in rows 2,3 with candidate 1 → should be eliminated
      puzzle.getCell('A2').setCandidates([1, 3, 4]);
      puzzle.getCell('A3').setCandidates([1, 3, 5]);

      // Other cells in rows 2,3 without candidate 1 (no eliminations from these)
      puzzle.getCell('C2').setCandidates([3, 4, 5]);
      puzzle.getCell('D2').setCandidates([3, 4, 6]);
      puzzle.getCell('E2').setCandidates([4, 5, 6]);
      puzzle.getCell('C3').setCandidates([3, 4, 5]);
      puzzle.getCell('D3').setCandidates([3, 4, 6]);
      puzzle.getCell('E3').setCandidates([4, 5, 6]);

      // Fill other rows with some candidates
      for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
        for (const row of [1, 4, 5, 6]) {
          puzzle.getCell(`${col}${String(row)}`).setCandidates([1, 2, 3, 4, 5, 6]);
        }
      }

      const result = strategy.tryApply(puzzle);
      expect(result).not.toBeNull();
      const r = ensureNonNullable(result);

      const matchingGroup = r.changeGroups.find(
        (g) => g.reason.includes('require 1') && g.reason.includes('rows (23)')
      );
      expect(matchingGroup).toBeDefined();

      const changes = ensureNonNullable(matchingGroup).changes as CandidatesStrikethrough[];
      const affectedCells = changes.map((c) => c.cell.ref).sort();
      expect(affectedCells).toEqual(['A2', 'A3']);
      for (const change of changes) {
        expect(change.values).toEqual([1]);
      }
    });

    it('finds column-based Cage X-Wing and eliminates from columns', () => {
      // 6x6 puzzle with two cages each requiring value 1
      // Cage @B2: B2,C2 (value 3+) → 1 required, 1-candidates in columns {B,C}
      // Cage @B5: B5,C5 (value 3+) → 1 required, 1-candidates in columns {B,C}
      // Both cages' 1-positions confined to columns {B,C} → Cage X-Wing
      // Eliminate 1 from B1, C1 (non-cage cells in columns B,C with candidate 1)
      const cages = fillRemainingCells([
        { cells: ['B2', 'C2'], operator: Operator.Plus, value: 3 },
        { cells: ['B5', 'C5'], operator: Operator.Plus, value: 3 }
      ], 6);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });

      puzzle.getCell('B2').setCandidates([1, 2]);
      puzzle.getCell('C2').setCandidates([1, 2]);
      puzzle.getCell('B5').setCandidates([1, 2]);
      puzzle.getCell('C5').setCandidates([1, 2]);

      // Non-cage cells in columns B,C with candidate 1
      puzzle.getCell('B1').setCandidates([1, 3, 4]);
      puzzle.getCell('C1').setCandidates([1, 3, 5]);

      // Other cells in columns B,C without candidate 1
      puzzle.getCell('B3').setCandidates([3, 4, 5]);
      puzzle.getCell('B4').setCandidates([3, 4, 6]);
      puzzle.getCell('B6').setCandidates([4, 5, 6]);
      puzzle.getCell('C3').setCandidates([3, 4, 5]);
      puzzle.getCell('C4').setCandidates([3, 4, 6]);
      puzzle.getCell('C6').setCandidates([4, 5, 6]);

      // Fill other columns with some candidates
      for (const col of ['A', 'D', 'E', 'F']) {
        for (let row = 1; row <= 6; row++) {
          puzzle.getCell(`${col}${String(row)}`).setCandidates([1, 2, 3, 4, 5, 6]);
        }
      }

      const result = strategy.tryApply(puzzle);
      expect(result).not.toBeNull();
      const r = ensureNonNullable(result);

      const matchingGroup = r.changeGroups.find(
        (g) => g.reason.includes('require 1') && g.reason.includes('columns (BC)')
      );
      expect(matchingGroup).toBeDefined();

      const changes = ensureNonNullable(matchingGroup).changes as CandidatesStrikethrough[];
      const affectedCells = changes.map((c) => c.cell.ref).sort();
      expect(affectedCells).toEqual(['B1', 'C1']);
      for (const change of changes) {
        expect(change.values).toEqual([1]);
      }
    });

    it('returns null when positions span too many rows', () => {
      // Two L-shaped cages requiring 1 but their 1-candidates span 4 rows and 4 columns
      // Cage @B2: B2,C3 → rows {2,3}, cols {B,C}
      // Cage @E4: E4,F5 → rows {4,5}, cols {E,F}
      // Row union = {2,3,4,5} = 4 ≠ 2, Column union = {B,C,E,F} = 4 ≠ 2 → no X-Wing
      const cages = fillRemainingCells([
        { cells: ['B2', 'C3'], operator: Operator.Plus, value: 3 },
        { cells: ['E4', 'F5'], operator: Operator.Plus, value: 3 }
      ], 6);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });

      puzzle.getCell('B2').setCandidates([1, 2]);
      puzzle.getCell('C3').setCandidates([1, 2]);
      puzzle.getCell('E4').setCandidates([1, 2]);
      puzzle.getCell('F5').setCandidates([1, 2]);

      // Fill remaining cells
      for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
        for (let row = 1; row <= 6; row++) {
          const ref = `${col}${String(row)}`;
          if (!['B2', 'C3', 'E4', 'F5'].includes(ref)) {
            puzzle.getCell(ref).setCandidates([1, 2, 3, 4, 5, 6]);
          }
        }
      }

      expect(strategy.tryApply(puzzle)).toBeNull();
    });

    it('returns null when no eliminations possible', () => {
      // Pattern found but all cross cells already lack candidate 1
      // Row-based: rows {2,3}, column-based: cols {B,F}
      // All non-cage cells in rows 2,3 AND columns B,F must lack candidate 1
      const cages = fillRemainingCells([
        { cells: ['B2', 'B3'], operator: Operator.Plus, value: 3 },
        { cells: ['F2', 'F3'], operator: Operator.Plus, value: 3 }
      ], 6);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });

      puzzle.getCell('B2').setCandidates([1, 2]);
      puzzle.getCell('B3').setCandidates([1, 2]);
      puzzle.getCell('F2').setCandidates([1, 2]);
      puzzle.getCell('F3').setCandidates([1, 2]);

      // Non-cage cells in rows 2,3 lack candidate 1
      for (const col of ['A', 'C', 'D', 'E']) {
        puzzle.getCell(`${col}2`).setCandidates([3, 4, 5]);
        puzzle.getCell(`${col}3`).setCandidates([3, 4, 5]);
      }

      // Non-cage cells in columns B,F (other rows) also lack candidate 1
      for (const col of ['B', 'F']) {
        for (const row of [1, 4, 5, 6]) {
          puzzle.getCell(`${col}${String(row)}`).setCandidates([3, 4, 5]);
        }
      }

      // Fill remaining cells (other rows, other columns)
      for (const col of ['A', 'C', 'D', 'E']) {
        for (const row of [1, 4, 5, 6]) {
          puzzle.getCell(`${col}${String(row)}`).setCandidates([1, 2, 3, 4, 5, 6]);
        }
      }

      expect(strategy.tryApply(puzzle)).toBeNull();
    });

    it('includes correct reason format', () => {
      const cages = fillRemainingCells([
        { cells: ['B2', 'B3'], operator: Operator.Plus, value: 3 },
        { cells: ['F2', 'F3'], operator: Operator.Plus, value: 3 }
      ], 6);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });

      puzzle.getCell('B2').setCandidates([1, 2]);
      puzzle.getCell('B3').setCandidates([1, 2]);
      puzzle.getCell('F2').setCandidates([1, 2]);
      puzzle.getCell('F3').setCandidates([1, 2]);

      puzzle.getCell('A2').setCandidates([1, 3, 4]);
      puzzle.getCell('A3').setCandidates([1, 3, 5]);

      for (const col of ['C', 'D', 'E']) {
        puzzle.getCell(`${col}2`).setCandidates([3, 4, 5]);
        puzzle.getCell(`${col}3`).setCandidates([3, 4, 5]);
      }

      for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
        for (const row of [1, 4, 5, 6]) {
          puzzle.getCell(`${col}${String(row)}`).setCandidates([1, 2, 3, 4, 5, 6]);
        }
      }

      const result = ensureNonNullable(strategy.tryApply(puzzle));
      const reasons = result.changeGroups.map((g) => g.reason);
      expect(reasons).toContain('@B2, @F2 require 1 in rows (23)');

      expect(result.details).toBeDefined();
      expect(ensureNonNullable(result.details)).toContain('@B2, @F2 require 1 in rows (23)');
    });
  });
});
