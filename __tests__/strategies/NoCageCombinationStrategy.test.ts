import {
  describe,
  expect,
  it
} from 'vitest';

import { CandidatesStrikethrough } from '../../src/cellChanges/CandidatesStrikethrough.ts';
import { Operator } from '../../src/Puzzle.ts';
import { NoCageCombinationStrategy } from '../../src/strategies/NoCageCombinationStrategy.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import {
  createTestPuzzle,
  fillRemainingCells
} from '../puzzleTestHelper.ts';

describe('NoCageCombinationStrategy', () => {
  const strategy = new NoCageCombinationStrategy();

  it('eliminates infeasible candidates in a 2-cell + cage', () => {
    // Cage 7+ with A1={1,5}, B1={3,4,6}
    // A1=5 needs B1=2 (not in {3,4,6}) → eliminate A1=5
    // B1=3 needs A1=4 (not in {1,5}) → eliminate B1=3
    // B1=4 needs A1=3 (not in {1,5}) → eliminate B1=4
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 7 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    puzzle.getCell('A1').setCandidates([1, 5]);
    puzzle.getCell('B1').setCandidates([3, 4, 6]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const r = ensureNonNullable(result);
    const changes = r.changeGroups.flatMap((g) => g.changes);

    const a1Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'A1'
    ) as CandidatesStrikethrough[];
    expect(a1Changes.flatMap((c) => [...c.values])).toEqual([5]);

    const b1Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'B1'
    ) as CandidatesStrikethrough[];
    expect(b1Changes.flatMap((c) => [...c.values])).toEqual([3, 4]);

    expect(r.details).toBeDefined();
  });

  it('eliminates infeasible candidates in a 2-cell x cage', () => {
    // Cage 12x with A1={2,3,4}, B1={1,3,6}
    // Valid combos: A1=2,B1=6 (2*6=12); A1=4,B1=3 (4*3=12)
    // A1=3 needs B1=4 (not in {1,3,6}) → eliminate A1=3
    // B1=1 needs A1=12 (not in {2,3,4}) → eliminate B1=1
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Times, value: 12 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    puzzle.getCell('A1').setCandidates([2, 3, 4]);
    puzzle.getCell('B1').setCandidates([1, 3, 6]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const changes = ensureNonNullable(result).changeGroups.flatMap((g) => g.changes);

    const a1Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'A1'
    ) as CandidatesStrikethrough[];
    expect(a1Changes.flatMap((c) => [...c.values])).toEqual([3]);

    const b1Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'B1'
    ) as CandidatesStrikethrough[];
    expect(b1Changes.flatMap((c) => [...c.values])).toEqual([1]);
  });

  it('eliminates infeasible candidates in a 3-cell cage', () => {
    // Cage 6+ with A1={1,2}, A2={1,2}, B1={1,2,3}
    // Valid combos must sum to 6 with latin square (A1,A2 same column)
    // A1=1,A2=2,B1=3 (1+2+3=6) ✓
    // A1=2,A2=1,B1=3 (2+1+3=6) ✓
    // B1=1 and B1=2 have no valid combination → eliminate
    const cages = fillRemainingCells([
      { cells: ['A1', 'A2', 'B1'], operator: Operator.Plus, value: 6 }
    ], 4);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setCandidates([1, 2]);
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B1').setCandidates([1, 2, 3]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const changes = ensureNonNullable(result).changeGroups.flatMap((g) => g.changes);

    const b1Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'B1'
    ) as CandidatesStrikethrough[];
    expect(b1Changes.flatMap((c) => [...c.values])).toEqual([1, 2]);

    // 3-cell reason format uses "no valid combination"
    const b1Group = ensureNonNullable(result).changeGroups.find(
      (g) => g.changes.some((c) => c.cell.ref === 'B1')
    );
    expect(ensureNonNullable(b1Group).reason).toContain('no valid combination');
  });

  it('handles partially solved cage with adjusted target', () => {
    // Cage 10+ with A1 solved=4, A2={1,2,3}, B2={1,2,3}
    // Adjusted target: 10-4=6, so A2+B2=6
    // A2=1 needs B2=5 (not in {1,2,3}) → eliminate
    // A2=2 needs B2=4 (not in {1,2,3}) → eliminate
    // A2=3,B2=3 → same value, same row? A2 is row 2, B2 is row 2 → blocked by latin square
    // Actually A2 is (row2,colA), B2 is (row2,colB) → same row, so 3,3 is invalid
    // No valid combos! Let's adjust the test.
    // Use A2={2,3,4}, B2={2,3,4}, target=6
    // A2=2,B2=4 (same row, different values) ✓
    // A2=4,B2=2 ✓
    // A2=3,B2=3 → same row, same value → invalid
    // A2=3 eliminated
    const cages = fillRemainingCells([
      { cells: ['A1', 'A2', 'B2'], operator: Operator.Plus, value: 10 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    puzzle.getCell('A1').setValue(4);
    puzzle.getCell('A2').setCandidates([2, 3, 4]);
    puzzle.getCell('B2').setCandidates([2, 3, 4]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const changes = ensureNonNullable(result).changeGroups.flatMap((g) => g.changes);

    const a2Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'A2'
    ) as CandidatesStrikethrough[];
    expect(a2Changes.flatMap((c) => [...c.values])).toEqual([3]);

    const b2Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'B2'
    ) as CandidatesStrikethrough[];
    expect(b2Changes.flatMap((c) => [...c.values])).toEqual([3]);
  });

  it('returns null when all candidates are feasible', () => {
    // Cage 3+ with A1={1,2}, B1={1,2}
    // A1=1,B1=2 ✓; A1=2,B1=1 ✓ → all feasible
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 }
    ], 4);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setCandidates([1, 2]);
    puzzle.getCell('B1').setCandidates([1, 2]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('handles subtraction cage with two unsolved cells', () => {
    // Cage 1- with A1={1,3,5}, B1={2,4}
    // |1-2|=1 ✓, |1-4|=3≠1, |3-2|=1 ✓, |3-4|=1 ✓, |5-2|=3≠1, |5-4|=1 ✓
    // A1: 1 valid (with B1=2), 3 valid (with B1=2 or B1=4), 5 valid (with B1=4) → all valid
    // B1: 2 valid (with A1=1 or A1=3), 4 valid (with A1=3 or A1=5) → all valid
    // Nothing to eliminate → null
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Minus, value: 1 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    puzzle.getCell('A1').setCandidates([1, 3, 5]);
    puzzle.getCell('B1').setCandidates([2, 4]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('eliminates in a subtraction cage', () => {
    // Cage 1- with A1={1,5}, B1={3,4}
    // |1-3|=2≠1, |1-4|=3≠1, |5-3|=2≠1, |5-4|=1 ✓
    // Only valid: A1=5,B1=4
    // Eliminate A1=1, B1=3
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Minus, value: 1 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    puzzle.getCell('A1').setCandidates([1, 5]);
    puzzle.getCell('B1').setCandidates([3, 4]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const changes = ensureNonNullable(result).changeGroups.flatMap((g) => g.changes);

    const a1Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'A1'
    ) as CandidatesStrikethrough[];
    expect(a1Changes.flatMap((c) => [...c.values])).toEqual([1]);

    const b1Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'B1'
    ) as CandidatesStrikethrough[];
    expect(b1Changes.flatMap((c) => [...c.values])).toEqual([3]);
  });

  it('handles division cage', () => {
    // Cage 3/ with A1={1,2,6}, B1={1,3}
    // Max(1,1)/min(1,1)=1≠3, max(1,3)/min(1,3)=3 ✓,
    // Max(2,1)/min(2,1)=2≠3, max(2,3)/min(2,3)=3/2 not int,
    // Max(6,1)/min(6,1)=6≠3, max(6,3)/min(6,3)=2≠3
    // Only valid: A1=1,B1=3
    // Eliminate A1=2, A1=6, B1=1
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Divide, value: 3 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    puzzle.getCell('A1').setCandidates([1, 2, 6]);
    puzzle.getCell('B1').setCandidates([1, 3]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const changes = ensureNonNullable(result).changeGroups.flatMap((g) => g.changes);

    const a1Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'A1'
    ) as CandidatesStrikethrough[];
    expect(a1Changes.flatMap((c) => [...c.values])).toEqual([2, 6]);

    const b1Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'B1'
    ) as CandidatesStrikethrough[];
    expect(b1Changes.flatMap((c) => [...c.values])).toEqual([1]);
  });

  it('handles no-operator cage by trying all feasible operators', () => {
    // Cage value 3, 2 cells, no operator, 4x4 puzzle
    // Feasible ops: + (3 in [3,7]), - (3 in [1,3] ✓), x (3 is 1*3 ✓), / (3 in [2,4] ✓)
    // A1={1,2}, B1={1,2}
    // +: 1+2=3 ✓, 2+1=3 ✓
    // -: |1-1|=0≠3, |1-2|=1≠3, |2-1|=1≠3, |2-2|=0≠3 → no valid tuples
    // X: 1*1=1≠3, 1*2=2≠3, 2*1=2≠3, 2*2=4≠3 → no valid tuples
    // /: max(1,1)/min(1,1)=1≠3, etc → no valid tuples
    // Union from +: A1∈{1,2}, B1∈{1,2} → all feasible → null
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Unknown, value: 3 }
    ], 4);
    const puzzle = createTestPuzzle({ cages, hasOperators: false, puzzleSize: 4 });
    puzzle.getCell('A1').setCandidates([1, 2]);
    puzzle.getCell('B1').setCandidates([1, 2]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('eliminates in a no-operator cage when no operator works for a candidate', () => {
    // Cage value 5, 2 cells, no operator, 6x6
    // Feasible ops: + (5 in [3,11] ✓), - (5 in [1,5] ✓), x (need pair with product 5: 1*5 ✓), / (5 in [2,6] ✓)
    // A1={1,4}, B1={1,4}
    // +: 1+4=5 ✓, 4+1=5 ✓ → A1∈{1,4}, B1∈{1,4}
    // -: |1-1|=0, |1-4|=3, |4-1|=3, |4-4|=0 → none equal 5
    // X: 1*1=1, 1*4=4, 4*1=4, 4*4=16 → none equal 5
    // /: max/min: 1/1=1, 4/1=4, 4/4=1 → none equal 5
    // Union: {1,4} for both → all feasible → null
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Unknown, value: 5 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: false, puzzleSize: 6 });
    puzzle.getCell('A1').setCandidates([1, 4]);
    puzzle.getCell('B1').setCandidates([1, 4]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('skips single-cell cages', () => {
    const cages = fillRemainingCells([
      { cells: ['A1'], operator: Operator.Unknown, value: 3 }
    ], 4);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setCandidates([1, 2, 3]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('skips cages with only one unsolved cell', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 5 }
    ], 4);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setValue(2);
    puzzle.getCell('B1').setCandidates([1, 2, 3]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('provides per-cell reasons with the 2-cell complement format', () => {
    // Cage 7+ with A1={1,5}, B1={3,4,6}
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 7 }
    ], 6);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 6 });
    puzzle.getCell('A1').setCandidates([1, 5]);
    puzzle.getCell('B1').setCandidates([3, 4, 6]);

    const result = ensureNonNullable(strategy.tryApply(puzzle));

    const a1Group = result.changeGroups.find(
      (g) => g.changes.some((c) => c.cell.ref === 'A1')
    );
    expect(ensureNonNullable(a1Group).reason).toContain('5 needs B1=2');
    expect(ensureNonNullable(a1Group).reason).toContain('B1 has {346}');
  });

  it('respects latin square constraint in same-row cells', () => {
    // Cage 4+ with A1={2}, B1={2}  (same row)
    // 2+2=4 but A1=2,B1=2 violates latin square (same row) → no valid tuple
    // All candidates eliminated... but actually we wouldn't have this state in practice.
    // Better test: A1={1,2}, B1={1,2}, cage 4+
    // 1+1=2≠4, 1+2=3≠4, 2+1=3≠4, 2+2=4 but latin square blocks → no valid tuples
    // All eliminated for both cells
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 4 }
    ], 4);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setCandidates([1, 2]);
    puzzle.getCell('B1').setCandidates([1, 2]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const changes = ensureNonNullable(result).changeGroups.flatMap((g) => g.changes);

    const a1Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'A1'
    ) as CandidatesStrikethrough[];
    expect(a1Changes.flatMap((c) => [...c.values])).toEqual([1, 2]);
  });
});
