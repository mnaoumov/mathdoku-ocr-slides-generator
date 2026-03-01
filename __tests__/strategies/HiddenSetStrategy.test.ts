import {
  describe,
  expect,
  it
} from 'vitest';

import { CandidatesStrikethrough } from '../../src/cellChanges/CandidatesStrikethrough.ts';
import { Operator } from '../../src/Puzzle.ts';
import { HiddenSetStrategy } from '../../src/strategies/HiddenSetStrategy.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import {
  createTestPuzzle,
  fillRemainingCells
} from '../puzzleTestHelper.ts';

const PAIR_SIZE = 2;
const TRIPLET_SIZE = 3;

describe('HiddenSetStrategy', () => {
  describe('Hidden pair (size 2)', () => {
    const strategy = new HiddenSetStrategy(PAIR_SIZE);

    it('has correct name', () => {
      expect(strategy.name).toBe('Hidden pair');
    });

    it('finds hidden pair and eliminates other candidates', () => {
      // 4x4 puzzle, row 1: A1={1,2,3,4}, B1={1,2,3}, C1={3,4}, D1={3,4}
      // Values 1,2 appear only in A1 and B1 → hidden pair {1,2} in (A1 B1)
      // Eliminate 3,4 from A1 and 3 from B1
      const cages = fillRemainingCells([
        { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
        { cells: ['C1', 'D1'], operator: Operator.Plus, value: 7 }
      ], 4);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });

      puzzle.getCell('A1').setCandidates([1, 2, 3, 4]);
      puzzle.getCell('B1').setCandidates([1, 2, 3]);
      puzzle.getCell('C1').setCandidates([3, 4]);
      puzzle.getCell('D1').setCandidates([3, 4]);

      const result = strategy.tryApply(puzzle);
      expect(result).not.toBeNull();
      const r = ensureNonNullable(result);
      const changes = r.changeGroups.flatMap((g) => g.changes);

      const a1Changes = changes.filter(
        (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'A1'
      ) as CandidatesStrikethrough[];
      expect(a1Changes.flatMap((c) => [...c.values])).toEqual([3, 4]);

      const b1Changes = changes.filter(
        (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'B1'
      ) as CandidatesStrikethrough[];
      expect(b1Changes.flatMap((c) => [...c.values])).toEqual([3]);
    });

    it('returns null when no hidden pair exists', () => {
      // All values appear in 3+ cells → no hidden pair
      const cages = fillRemainingCells([], 4);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });

      puzzle.getCell('A1').setCandidates([1, 2, 3]);
      puzzle.getCell('B1').setCandidates([1, 2, 3]);
      puzzle.getCell('C1').setCandidates([1, 2, 3]);
      puzzle.getCell('D1').setCandidates([4]);

      expect(strategy.tryApply(puzzle)).toBeNull();
    });

    it('returns null when hidden pair cells have no extra candidates', () => {
      // Values 1,2 in exactly 2 cells, but those cells only have {1,2} → nothing to eliminate
      const cages = fillRemainingCells([], 4);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });

      puzzle.getCell('A1').setCandidates([1, 2]);
      puzzle.getCell('B1').setCandidates([1, 2]);
      puzzle.getCell('C1').setCandidates([3, 4]);
      puzzle.getCell('D1').setCandidates([3, 4]);

      expect(strategy.tryApply(puzzle)).toBeNull();
    });

    it('includes correct reason format', () => {
      const cages = fillRemainingCells([
        { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
        { cells: ['C1', 'D1'], operator: Operator.Plus, value: 7 }
      ], 4);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });

      puzzle.getCell('A1').setCandidates([1, 2, 3, 4]);
      puzzle.getCell('B1').setCandidates([1, 2, 3]);
      puzzle.getCell('C1').setCandidates([3, 4]);
      puzzle.getCell('D1').setCandidates([3, 4]);

      const result = ensureNonNullable(strategy.tryApply(puzzle));
      const reasons = result.changeGroups.map((g) => g.reason);
      expect(reasons).toContain('{12} (A1 B1)');
    });
  });

  describe('Hidden triplet (size 3)', () => {
    const strategy = new HiddenSetStrategy(TRIPLET_SIZE);

    it('has correct name', () => {
      expect(strategy.name).toBe('Hidden triplet');
    });

    it('finds hidden triplet and eliminates other candidates', () => {
      // 5x5 puzzle, row 1:
      // A1={1,2,3,4,5}, B1={1,2,5}, C1={4,5}, D1={4,5}, E1={4,5}
      // Values 1,2,3 appear only in A1 and B1... but that's only 2 cells for 3 values → not a triplet
      // Let me rethink:
      // A1={1,2,4,5}, B1={2,3,4,5}, C1={1,3,4,5}, D1={4,5}, E1={4,5}
      // Values 1,2,3 appear in: A1 (1,2), B1 (2,3), C1 (1,3) → exactly 3 cells → hidden triplet
      // Eliminate 4,5 from A1; 4,5 from B1; 4,5 from C1
      const cages = fillRemainingCells([], 5);
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 5 });

      puzzle.getCell('A1').setCandidates([1, 2, 4, 5]);
      puzzle.getCell('B1').setCandidates([2, 3, 4, 5]);
      puzzle.getCell('C1').setCandidates([1, 3, 4, 5]);
      puzzle.getCell('D1').setCandidates([4, 5]);
      puzzle.getCell('E1').setCandidates([4, 5]);

      const result = strategy.tryApply(puzzle);
      expect(result).not.toBeNull();
      const r = ensureNonNullable(result);
      const changes = r.changeGroups.flatMap((g) => g.changes);

      const a1Changes = changes.filter(
        (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'A1'
      ) as CandidatesStrikethrough[];
      expect(a1Changes.flatMap((c) => [...c.values])).toEqual([4, 5]);

      const b1Changes = changes.filter(
        (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'B1'
      ) as CandidatesStrikethrough[];
      expect(b1Changes.flatMap((c) => [...c.values])).toEqual([4, 5]);

      const c1Changes = changes.filter(
        (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'C1'
      ) as CandidatesStrikethrough[];
      expect(c1Changes.flatMap((c) => [...c.values])).toEqual([4, 5]);

      const reasons = r.changeGroups.map((g) => g.reason);
      expect(reasons).toContain('{123} (A1 B1 C1)');
    });
  });
});
