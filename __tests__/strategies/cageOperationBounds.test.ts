import {
  describe,
  expect,
  it
} from 'vitest';

import { Operator } from '../../src/Puzzle.ts';
import {
  canBeOperator,
  deduceOperator,
  getEffectiveOperator
} from '../../src/strategies/cageOperationBounds.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import { createTestPuzzle } from '../puzzleTestHelper.ts';

const PUZZLE_SIZE_6 = 6;

describe('cageOperationBounds', () => {
  describe('canBeOperator rejects multiplication with non-divisor cell', () => {
    it('rejects when a cell has a solved non-divisor value', () => {
      // Cage value 12, 3 cells in 6x6. One cell solved=5. 12 % 5 !== 0 → Times infeasible
      const cages = [
        { cells: ['A1', 'B1', 'C1'], operator: Operator.Plus, value: 12 },
        { cells: ['D1', 'E1', 'F1'], operator: Operator.Plus, value: 9 },
        { cells: ['A2', 'B2', 'C2'], operator: Operator.Plus, value: 9 },
        { cells: ['D2', 'E2', 'F2'], operator: Operator.Plus, value: 12 },
        { cells: ['A3', 'B3', 'C3'], operator: Operator.Plus, value: 9 },
        { cells: ['D3', 'E3', 'F3'], operator: Operator.Plus, value: 12 },
        { cells: ['A4', 'B4', 'C4'], operator: Operator.Plus, value: 12 },
        { cells: ['D4', 'E4', 'F4'], operator: Operator.Plus, value: 9 },
        { cells: ['A5', 'B5', 'C5'], operator: Operator.Plus, value: 12 },
        { cells: ['D5', 'E5', 'F5'], operator: Operator.Plus, value: 9 },
        { cells: ['A6', 'B6', 'C6'], operator: Operator.Plus, value: 9 },
        { cells: ['D6', 'E6', 'F6'], operator: Operator.Plus, value: 12 }
      ];
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: PUZZLE_SIZE_6 });
      for (const cell of puzzle.cells) {
        cell.setCandidates([1, 2, 3, 4, 5, 6]);
      }
      // Solve A1 = 5 (5 does not divide 12)
      puzzle.getCell('A1').setValue(5);

      const cage = ensureNonNullable(puzzle.cages[0]);
      expect(canBeOperator(Operator.Times, cage.value, cage.cells, PUZZLE_SIZE_6)).toBe(false);
    });

    it('rejects when all candidates of a cell are non-divisors', () => {
      // Cage value 12, 3 cells in 6x6. One cell has candidates {5} only
      const cages = [
        { cells: ['A1', 'B1', 'C1'], operator: Operator.Plus, value: 12 },
        { cells: ['D1', 'E1', 'F1'], operator: Operator.Plus, value: 9 },
        { cells: ['A2', 'B2', 'C2'], operator: Operator.Plus, value: 9 },
        { cells: ['D2', 'E2', 'F2'], operator: Operator.Plus, value: 12 },
        { cells: ['A3', 'B3', 'C3'], operator: Operator.Plus, value: 9 },
        { cells: ['D3', 'E3', 'F3'], operator: Operator.Plus, value: 12 },
        { cells: ['A4', 'B4', 'C4'], operator: Operator.Plus, value: 12 },
        { cells: ['D4', 'E4', 'F4'], operator: Operator.Plus, value: 9 },
        { cells: ['A5', 'B5', 'C5'], operator: Operator.Plus, value: 12 },
        { cells: ['D5', 'E5', 'F5'], operator: Operator.Plus, value: 9 },
        { cells: ['A6', 'B6', 'C6'], operator: Operator.Plus, value: 9 },
        { cells: ['D6', 'E6', 'F6'], operator: Operator.Plus, value: 12 }
      ];
      const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: PUZZLE_SIZE_6 });
      for (const cell of puzzle.cells) {
        cell.setCandidates([1, 2, 3, 4, 5, 6]);
      }
      // A1 has only candidate 5 (non-divisor of 12)
      puzzle.getCell('A1').setCandidates([5]);

      const cage = ensureNonNullable(puzzle.cages[0]);
      expect(canBeOperator(Operator.Times, cage.value, cage.cells, PUZZLE_SIZE_6)).toBe(false);
    });
  });

  it('deduceOperator succeeds due to non-divisor check', () => {
    // Cage value 12, 3 cells in 6x6. One cell has candidates {5}.
    // Without the non-divisor check, both Plus and Times would be feasible → Unknown.
    // With the check, Times is ruled out → returns Plus.
    const cages = [
      { cells: ['A1', 'B1', 'C1'], operator: Operator.Plus, value: 12 },
      { cells: ['D1', 'E1', 'F1'], operator: Operator.Plus, value: 9 },
      { cells: ['A2', 'B2', 'C2'], operator: Operator.Plus, value: 9 },
      { cells: ['D2', 'E2', 'F2'], operator: Operator.Plus, value: 12 },
      { cells: ['A3', 'B3', 'C3'], operator: Operator.Plus, value: 9 },
      { cells: ['D3', 'E3', 'F3'], operator: Operator.Plus, value: 12 },
      { cells: ['A4', 'B4', 'C4'], operator: Operator.Plus, value: 12 },
      { cells: ['D4', 'E4', 'F4'], operator: Operator.Plus, value: 9 },
      { cells: ['A5', 'B5', 'C5'], operator: Operator.Plus, value: 12 },
      { cells: ['D5', 'E5', 'F5'], operator: Operator.Plus, value: 9 },
      { cells: ['A6', 'B6', 'C6'], operator: Operator.Plus, value: 9 },
      { cells: ['D6', 'E6', 'F6'], operator: Operator.Plus, value: 12 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: PUZZLE_SIZE_6 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4, 5, 6]);
    }
    puzzle.getCell('A1').setCandidates([5]);

    const cage = ensureNonNullable(puzzle.cages[0]);
    expect(deduceOperator(cage.value, cage.cells, PUZZLE_SIZE_6)).toBe(Operator.Plus);
  });

  describe('getEffectiveOperator', () => {
    it('caches deduced result on cage', () => {
      // Cage with Unknown operator where deduction succeeds
      const cages = [
        { cells: ['A1', 'B1', 'C1'], operator: Operator.Unknown, value: 12 },
        { cells: ['D1', 'E1', 'F1'], operator: Operator.Plus, value: 9 },
        { cells: ['A2', 'B2', 'C2'], operator: Operator.Plus, value: 9 },
        { cells: ['D2', 'E2', 'F2'], operator: Operator.Plus, value: 12 },
        { cells: ['A3', 'B3', 'C3'], operator: Operator.Plus, value: 9 },
        { cells: ['D3', 'E3', 'F3'], operator: Operator.Plus, value: 12 },
        { cells: ['A4', 'B4', 'C4'], operator: Operator.Plus, value: 12 },
        { cells: ['D4', 'E4', 'F4'], operator: Operator.Plus, value: 9 },
        { cells: ['A5', 'B5', 'C5'], operator: Operator.Plus, value: 12 },
        { cells: ['D5', 'E5', 'F5'], operator: Operator.Plus, value: 9 },
        { cells: ['A6', 'B6', 'C6'], operator: Operator.Plus, value: 9 },
        { cells: ['D6', 'E6', 'F6'], operator: Operator.Plus, value: 12 }
      ];
      const puzzle = createTestPuzzle({ cages, hasOperators: false, puzzleSize: PUZZLE_SIZE_6 });
      for (const cell of puzzle.cells) {
        cell.setCandidates([1, 2, 3, 4, 5, 6]);
      }
      puzzle.getCell('A1').setCandidates([5]);

      const cage = ensureNonNullable(puzzle.cages[0]);
      expect(cage.deducedOperator).toBeUndefined();

      const result1 = getEffectiveOperator(cage, PUZZLE_SIZE_6);
      expect(result1).toBe(Operator.Plus);
      expect(cage.deducedOperator).toBe(Operator.Plus);

      // Second call returns cached result
      const result2 = getEffectiveOperator(cage, PUZZLE_SIZE_6);
      expect(result2).toBe(Operator.Plus);
    });

    it('does not cache Unknown result', () => {
      // Cage where deduction fails (both + and × feasible)
      const cages = [
        { cells: ['A1', 'B1', 'C1'], operator: Operator.Unknown, value: 12 },
        { cells: ['D1', 'E1', 'F1'], operator: Operator.Plus, value: 9 },
        { cells: ['A2', 'B2', 'C2'], operator: Operator.Plus, value: 9 },
        { cells: ['D2', 'E2', 'F2'], operator: Operator.Plus, value: 12 },
        { cells: ['A3', 'B3', 'C3'], operator: Operator.Plus, value: 9 },
        { cells: ['D3', 'E3', 'F3'], operator: Operator.Plus, value: 12 },
        { cells: ['A4', 'B4', 'C4'], operator: Operator.Plus, value: 12 },
        { cells: ['D4', 'E4', 'F4'], operator: Operator.Plus, value: 9 },
        { cells: ['A5', 'B5', 'C5'], operator: Operator.Plus, value: 12 },
        { cells: ['D5', 'E5', 'F5'], operator: Operator.Plus, value: 9 },
        { cells: ['A6', 'B6', 'C6'], operator: Operator.Plus, value: 9 },
        { cells: ['D6', 'E6', 'F6'], operator: Operator.Plus, value: 12 }
      ];
      const puzzle = createTestPuzzle({ cages, hasOperators: false, puzzleSize: PUZZLE_SIZE_6 });
      for (const cell of puzzle.cells) {
        cell.setCandidates([1, 2, 3, 4, 5, 6]);
      }

      const cage = ensureNonNullable(puzzle.cages[0]);
      const result = getEffectiveOperator(cage, PUZZLE_SIZE_6);
      expect(result).toBe(Operator.Unknown);
      expect(cage.deducedOperator).toBeUndefined();
    });
  });
});
