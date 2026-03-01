import {
  describe,
  expect,
  it
} from 'vitest';

import { CandidatesStrikethrough } from '../../src/cellChanges/CandidatesStrikethrough.ts';
import { Operator } from '../../src/Puzzle.ts';
import { RequiredCageCandidateStrategy } from '../../src/strategies/RequiredCageCandidateStrategy.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import {
  createTestPuzzle,
  fillRemainingCells
} from '../puzzleTestHelper.ts';

describe('RequiredCageCandidateStrategy', () => {
  const strategy = new RequiredCageCandidateStrategy();

  it('eliminates required value from non-cage cells in shared row', () => {
    // Row 1: cage 6+ with A1,B1; remaining cells C1,D1
    // A1={1,2,4}, B1={1,2,4}
    // Valid combos for 6+: 2+4=6 ✓, 4+2=6 ✓
    // Every combo contains both 2 and 4 → 2 and 4 required in row 1
    // C1 and D1 should have 2 and 4 eliminated
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 6 },
      { cells: ['C1'], operator: Operator.Exact, value: 1 },
      { cells: ['D1'], operator: Operator.Exact, value: 3 }
    ], 4);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setCandidates([1, 2, 4]);
    puzzle.getCell('B1').setCandidates([1, 2, 4]);
    puzzle.getCell('C1').setCandidates([1, 2, 3, 4]);
    puzzle.getCell('D1').setCandidates([1, 2, 3, 4]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const r = ensureNonNullable(result);
    const changes = r.changeGroups.flatMap((g) => g.changes);

    // Value 2 should be eliminated from C1 and D1
    const eliminationOf2 = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.values.includes(2)
    ) as CandidatesStrikethrough[];
    const cellsLosing2 = eliminationOf2.map((c) => c.cell.ref).sort();
    expect(cellsLosing2).toEqual(['C1', 'D1']);

    // Value 4 should be eliminated from C1 and D1
    const eliminationOf4 = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.values.includes(4)
    ) as CandidatesStrikethrough[];
    const cellsLosing4 = eliminationOf4.map((c) => c.cell.ref).sort();
    expect(cellsLosing4).toEqual(['C1', 'D1']);
  });

  it('eliminates required value from non-cage cells in shared column', () => {
    // Column A: cage 7+ with A1,A2; remaining cells A3,A4
    // A1={3,4}, A2={3,4}
    // Valid combos for 7+: 3+4=7 ✓, 4+3=7 ✓
    // Every combo contains 3 and 4 → both required in column A
    const cages = fillRemainingCells([
      { cells: ['A1', 'A2'], operator: Operator.Plus, value: 7 },
      { cells: ['A3'], operator: Operator.Exact, value: 1 },
      { cells: ['A4'], operator: Operator.Exact, value: 2 }
    ], 4);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setCandidates([3, 4]);
    puzzle.getCell('A2').setCandidates([3, 4]);
    puzzle.getCell('A3').setCandidates([1, 2, 3, 4]);
    puzzle.getCell('A4').setCandidates([1, 2, 3, 4]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const changes = ensureNonNullable(result).changeGroups.flatMap((g) => g.changes);

    const cellRefs = changes.map((c) => c.cell.ref).sort();
    // A3 and A4 should lose both 3 and 4
    expect(cellRefs).toContain('A3');
    expect(cellRefs).toContain('A4');

    for (const ref of ['A3', 'A4']) {
      const cellChanges = changes.filter(
        (c) => c.cell.ref === ref && c instanceof CandidatesStrikethrough
      ) as CandidatesStrikethrough[];
      const eliminated = cellChanges.flatMap((c) => [...c.values]).sort((a, b) => a - b);
      expect(eliminated).toContain(3);
      expect(eliminated).toContain(4);
    }
  });

  it('skips non-linear cage (L-shape)', () => {
    // Cage with A1,B1,A2 — not all in same row or column
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1', 'A2'], operator: Operator.Plus, value: 9 }
    ], 4);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setCandidates([1, 2, 3, 4]);
    puzzle.getCell('B1').setCandidates([1, 2, 3, 4]);
    puzzle.getCell('A2').setCandidates([1, 2, 3, 4]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('returns null when not all combos require the same value', () => {
    // Cage 5+ with A1,B1, both have {1,2,3,4}
    // Combos: 1+4=5 ✓, 4+1=5 ✓, 2+3=5 ✓, 3+2=5 ✓
    // Values: 1 appears in some (1+4), not others (2+3) → not required
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 5 }
    ], 4);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setCandidates([1, 2, 3, 4]);
    puzzle.getCell('B1').setCandidates([1, 2, 3, 4]);
    puzzle.getCell('C1').setCandidates([1, 2, 3, 4]);
    puzzle.getCell('D1').setCandidates([1, 2, 3, 4]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('returns null when rest of house already lacks the candidate', () => {
    // Cage 6+ with A1,B1; C1 and D1 don't have 2 or 4
    // Even though 2 and 4 are required by cage, no eliminations possible
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 6 },
      { cells: ['C1'], operator: Operator.Exact, value: 1 },
      { cells: ['D1'], operator: Operator.Exact, value: 3 }
    ], 4);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setCandidates([2, 4]);
    puzzle.getCell('B1').setCandidates([2, 4]);
    puzzle.getCell('C1').setCandidates([1, 3]);
    puzzle.getCell('D1').setCandidates([1, 3]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('includes correct reason format', () => {
    const cages = fillRemainingCells([
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 6 },
      { cells: ['C1'], operator: Operator.Exact, value: 1 },
      { cells: ['D1'], operator: Operator.Exact, value: 3 }
    ], 4);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setCandidates([2, 4]);
    puzzle.getCell('B1').setCandidates([2, 4]);
    puzzle.getCell('C1').setCandidates([1, 2, 3, 4]);
    puzzle.getCell('D1').setCandidates([1, 2, 3, 4]);

    const result = ensureNonNullable(strategy.tryApply(puzzle));
    const reasons = result.changeGroups.map((g) => g.reason);
    expect(reasons).toContain('@A1 requires 2 in row 1');
    expect(reasons).toContain('@A1 requires 4 in row 1');

    expect(result.details).toBeDefined();
    expect(ensureNonNullable(result.details)).toContain('@A1');
  });

  it('skips single-cell cages', () => {
    const cages = fillRemainingCells([
      { cells: ['A1'], operator: Operator.Exact, value: 3 }
    ], 4);
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setCandidates([1, 2, 3]);

    expect(strategy.tryApply(puzzle)).toBeNull();
  });
});
