import {
  describe,
  expect,
  it
} from 'vitest';

import { CandidatesStrikethrough } from '../../src/cellChanges/CandidatesStrikethrough.ts';
import { ValueChange } from '../../src/cellChanges/ValueChange.ts';
import { Operator } from '../../src/Puzzle.ts';
import { InniesOutiesStrategy } from '../../src/strategies/InniesOutiesStrategy.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import { createTestPuzzle } from '../puzzleTestHelper.ts';

describe('InniesOutiesStrategy', () => {
  const strategy = new InniesOutiesStrategy();

  it('has correct name', () => {
    expect(strategy.name).toBe('Innies/Outies');
  });

  it('deduces single unknown cell value from house sum', () => {
    // 4x4 puzzle. Row 1 has house total = 1+2+3+4 = 10
    // Cages: {A1,A2} 3+, {B1,B2} 5+, {C1} 3 (single), {D1,D2} 7+
    // Row 1 cells: A1, B1, C1, D1
    // {C1} is fully in row 1 → contributes 3
    // {A1,A2}: A2 is in row 2 (outer). If A2 solved=2, contribution = 3-2 = 1
    // {B1,B2}: B2 is in row 2 (outer). If B2 solved=3, contribution = 5-3 = 2
    // {D1,D2}: D2 is in row 2 (outer). If D2 solved=4, contribution = 7-4 = 3
    // Known sum = 3 + 1 + 2 + 3 = 9. But that leaves 10-9 = 1 unknown.
    // Wait, all innies are solved in that case... Let me design differently.

    // Row 1 total = 10. Three fully-contained + cages account for 3 cells:
    // {A1,B1} 3+, {C1} single=3 → contributes 3
    // {D1,D2} spans row 1 and 2. D2 solved=4. Contribution = value - 4
    // Need A1+B1+C1+D1 = 10, C1=3, so A1+B1+D1 = 7
    // If {A1,B1}=3+ and D1 is unknown:
    // Known = 3 (from {A1,B1}) + 3 (from C1). Remaining = 10 - 3 - 3 = 4
    // But {D1,D2} has D2 solved, contribution = value - 4
    // Let me make this cleaner.

    // 4x4 puzzle. Row 1 total = 10
    // Cages: {A1,B1} 3+, {C1,D1} 3+ (both fully in row 1)
    // But then all innies known: 3+3=6≠10. Not right since cage cells span the row.

    // Better approach: all cages in row 1 are fully contained + cages
    // {A1} single=1, {B1} single=2, {C1} single=3, {D1,D2} 8+
    // D2 in row 2, solved=4 → D1 contribution = 8-4 = 4
    // Known = 1+2+3+4 = 10 = house total → no unknowns, nothing to do

    // Let me design a proper test:
    // {A1,B1} 5+, {C1,C2} 7+, {D1} single=4
    // Row 1: A1, B1, C1, D1. Total = 10
    // {A1,B1} fully in row 1 → contribution 5
    // {C1,C2}: C2 in row 2, solved=3 → contribution = 7-3 = 4
    // {D1} single → contribution 4
    // Known = 5 + 4 + 4 = 13 > 10. That's wrong because A1+B1=5, C1=4, D1=4 = 13 but row should be 10.
    // The issue is these values aren't consistent. Let me use realistic values.

    // 4x4 puzzle. Row 1: A1+B1+C1+D1 = 10
    // {A1,B1} 3+ (A1=1, B1=2 → fully in row 1)
    // {C1,C2} 5+ (C1 in row 1, C2 in row 2, C2 solved=2 → contribution = 5-2 = 3)
    // {D1} is the unknown single cell
    // Known = 3 + 3 = 6. Remaining = 10 - 6 = 4. D1 = 4.
    const cages = [
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
      { cells: ['C1', 'C2'], operator: Operator.Plus, value: 5 },
      { cells: ['D1', 'D2'], operator: Operator.Plus, value: 7 },
      { cells: ['A2', 'B2'], operator: Operator.Plus, value: 7 },
      { cells: ['A3', 'A4'], operator: Operator.Plus, value: 5 },
      { cells: ['B3', 'B4'], operator: Operator.Plus, value: 5 },
      { cells: ['C3', 'C4'], operator: Operator.Plus, value: 5 },
      { cells: ['D3', 'D4'], operator: Operator.Plus, value: 5 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });

    // Set all cells as unsolved with candidates
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4]);
    }

    // Solve the outer cell C2 so cage {C1,C2} has known contribution
    puzzle.getCell('C2').setValue(2);

    // Solve D2 so cage {D1,D2} has known contribution = 7-3 = 4
    puzzle.getCell('D2').setValue(3);

    // Row 1 total = 10
    // {A1,B1} fully in row → contribution 3
    // {C1,C2} C2 solved=2 → contribution 5-2 = 3
    // {D1,D2} D2 solved=3 → contribution 7-3 = 4
    // Known = 3+3+4 = 10. No unknowns. Hmm, all cages have known contributions.
    // I need a cage whose outies are NOT solved.

    // Let me redesign: have one cage where outies are unsolved
    // {A1,A2} 3+ spans rows 1&2. A2 is in row 2 → outer. A2 NOT solved.
    // → this cage is "unknown" for row 1.
    // {B1} single=2, {C1} single=3, {D1,D2} 8+ with D2 solved=4 → contribution 4
    // Known = 2 + 3 + 4 = 9. Remaining = 10 - 9 = 1.
    // Only unknown innie cell is A1. A1 must be 1.

    const cages2 = [
      { cells: ['A1', 'A2'], operator: Operator.Plus, value: 3 },
      { cells: ['B1'], operator: Operator.Plus, value: 2 },
      { cells: ['C1'], operator: Operator.Plus, value: 3 },
      { cells: ['D1', 'D2'], operator: Operator.Plus, value: 8 },
      { cells: ['B2', 'C2'], operator: Operator.Plus, value: 5 },
      { cells: ['A3', 'A4'], operator: Operator.Plus, value: 5 },
      { cells: ['B3', 'B4'], operator: Operator.Plus, value: 5 },
      { cells: ['C3', 'C4'], operator: Operator.Plus, value: 5 },
      { cells: ['D3', 'D4'], operator: Operator.Plus, value: 5 }
    ];
    const puzzle2 = createTestPuzzle({ cages: cages2, hasOperators: true, puzzleSize: 4 });
    for (const cell of puzzle2.cells) {
      cell.setCandidates([1, 2, 3, 4]);
    }
    // D2 solved=4 → {D1,D2} contribution = 8-4 = 4
    puzzle2.getCell('D2').setValue(4);

    // Row 1: {B1}=2 known, {C1}=3 known, {D1,D2} contribution=4 known
    // {A1,A2} A2 not solved → A1 is the only unknown innie
    // known = 2+3+4 = 9, remaining = 10-9 = 1, A1 = 1
    const result = strategy.tryApply(puzzle2);
    expect(result).not.toBeNull();
    const r = ensureNonNullable(result);
    const changes = r.changeGroups.flatMap((g) => g.changes);
    const valueChanges = changes.filter((c) => c instanceof ValueChange);
    expect(valueChanges.some((c) => c.cell.ref === 'A1' && c.value === 1)).toBe(true);
  });

  it('eliminates candidates from multiple unknown cells', () => {
    // 4x4 puzzle. Row 1 total = 10
    // {A1,A2} 3+ spans rows 1&2 — A2 unsolved → A1 unknown
    // {B1,B2} 5+ spans rows 1&2 — B2 unsolved → B1 unknown
    // {C1} single=3 → known = 3
    // {D1} single=4 → known = 4
    // Known = 3+4 = 7. Remaining = 10-7 = 3. Unknown: A1, B1
    // A1+B1 = 3 with distinct values from 1..4
    // Min of other = 1, max of other = 4
    // So A1 can be at most 3-1=2, at least 3-4=-1 → at least 1
    // And B1 same bounds
    // Eliminate 3,4 from both A1 and B1
    const cages = [
      { cells: ['A1', 'A2'], operator: Operator.Plus, value: 3 },
      { cells: ['B1', 'B2'], operator: Operator.Plus, value: 5 },
      { cells: ['C1'], operator: Operator.Plus, value: 3 },
      { cells: ['D1'], operator: Operator.Plus, value: 4 },
      { cells: ['C2', 'D2'], operator: Operator.Plus, value: 5 },
      { cells: ['A3', 'A4'], operator: Operator.Plus, value: 5 },
      { cells: ['B3', 'B4'], operator: Operator.Plus, value: 5 },
      { cells: ['C3', 'C4'], operator: Operator.Plus, value: 5 },
      { cells: ['D3', 'D4'], operator: Operator.Plus, value: 5 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4]);
    }

    // Row 1: A1 unknown, B1 unknown, C1=3 known, D1=4 known
    // remaining = 10 - 3 - 4 = 3
    // For 2 cells summing to 3: each can be at most 3-1=2
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
    expect(b1Changes.flatMap((c) => [...c.values])).toEqual([3, 4]);
  });

  it('returns null when all cages are fully contained', () => {
    // All cages fully in each house → known sum = cage sums = house total → no unknowns
    // 4x4 puzzle with row-aligned cages:
    const cages = [
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
      { cells: ['C1', 'D1'], operator: Operator.Plus, value: 7 },
      { cells: ['A2', 'B2'], operator: Operator.Plus, value: 5 },
      { cells: ['C2', 'D2'], operator: Operator.Plus, value: 5 },
      { cells: ['A3', 'B3'], operator: Operator.Plus, value: 5 },
      { cells: ['C3', 'D3'], operator: Operator.Plus, value: 5 },
      { cells: ['A4', 'B4'], operator: Operator.Plus, value: 5 },
      { cells: ['C4', 'D4'], operator: Operator.Plus, value: 5 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4]);
    }

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('returns null when outies are unsolved', () => {
    // All cages span multiple houses and outies are unsolved → all unknown
    const cages = [
      { cells: ['A1', 'A2'], operator: Operator.Plus, value: 3 },
      { cells: ['B1', 'B2'], operator: Operator.Plus, value: 3 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 2 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2]);
    }

    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('skips non-plus cages as unknown', () => {
    // 4x4 with multiplication cage → treated as unknown
    // {A1,B1} 2x — not + → unknown
    // {C1} single 3+ → known = 3
    // {D1} single 4+ → known = 4
    // But A1 and B1 are unknown innies → remaining = 10-3-4 = 3
    // Even though {A1,B1} is × cage, the strategy treats it as unknown
    // So A1+B1 should sum to 3 → can eliminate candidates > 2
    const cages = [
      { cells: ['A1', 'B1'], operator: Operator.Times, value: 2 },
      { cells: ['C1'], operator: Operator.Plus, value: 3 },
      { cells: ['D1'], operator: Operator.Plus, value: 4 },
      { cells: ['A2', 'B2'], operator: Operator.Plus, value: 5 },
      { cells: ['C2', 'D2'], operator: Operator.Plus, value: 5 },
      { cells: ['A3', 'A4'], operator: Operator.Plus, value: 5 },
      { cells: ['B3', 'B4'], operator: Operator.Plus, value: 5 },
      { cells: ['C3', 'C4'], operator: Operator.Plus, value: 5 },
      { cells: ['D3', 'D4'], operator: Operator.Plus, value: 5 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4]);
    }

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const r = ensureNonNullable(result);
    const changes = r.changeGroups.flatMap((g) => g.changes);

    // A1 and B1 are unknown, sum must be 3, so max value is 2
    const a1Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'A1'
    ) as CandidatesStrikethrough[];
    expect(a1Changes.flatMap((c) => [...c.values])).toEqual([3, 4]);
  });

  it('includes correct reason format for single cell', () => {
    const cages = [
      { cells: ['A1', 'A2'], operator: Operator.Plus, value: 3 },
      { cells: ['B1'], operator: Operator.Plus, value: 2 },
      { cells: ['C1'], operator: Operator.Plus, value: 3 },
      { cells: ['D1', 'D2'], operator: Operator.Plus, value: 8 },
      { cells: ['B2', 'C2'], operator: Operator.Plus, value: 5 },
      { cells: ['A3', 'A4'], operator: Operator.Plus, value: 5 },
      { cells: ['B3', 'B4'], operator: Operator.Plus, value: 5 },
      { cells: ['C3', 'C4'], operator: Operator.Plus, value: 5 },
      { cells: ['D3', 'D4'], operator: Operator.Plus, value: 5 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4]);
    }
    puzzle.getCell('D2').setValue(4);

    const result = ensureNonNullable(strategy.tryApply(puzzle));
    expect(result.details).toContain('row 1 sum 1, A1 = 1');
  });
});
