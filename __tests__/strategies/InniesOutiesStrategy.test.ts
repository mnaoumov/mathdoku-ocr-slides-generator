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
      { cells: ['B1'], operator: Operator.Exact, value: 2 },
      { cells: ['C1'], operator: Operator.Exact, value: 3 },
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
    // Known = 2+3+4 = 9, remaining = 10-9 = 1, A1 = 1
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
      { cells: ['C1'], operator: Operator.Exact, value: 3 },
      { cells: ['D1'], operator: Operator.Exact, value: 4 },
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
    // Remaining = 10 - 3 - 4 = 3
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
      { cells: ['C1'], operator: Operator.Exact, value: 3 },
      { cells: ['D1'], operator: Operator.Exact, value: 4 },
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

  it('subtracts solved cells in non-plus cages from house total', () => {
    // 4x4 puzzle. Row 1 total = 10
    // {A1} single cell, Operator.Exact (value 4) — A1 solved=4
    // {B1,B2} 2x (multiplication) — non-plus, but B1 solved=3
    // {C1,C2} 5+ — C2 unsolved → C1 is unknown innie
    // {D1} single cell, Operator.Exact (value 2) — D1 solved=2
    // Solved cells: A1=4, B1=3, D1=2 → knownSum = 4+3+2 = 9
    // Remaining = 10-9 = 1 → C1 = 1
    const cages = [
      { cells: ['A1'], operator: Operator.Exact, value: 4 },
      { cells: ['B1', 'B2'], operator: Operator.Times, value: 6 },
      { cells: ['C1', 'C2'], operator: Operator.Plus, value: 5 },
      { cells: ['D1'], operator: Operator.Exact, value: 2 },
      { cells: ['A2', 'D2'], operator: Operator.Plus, value: 5 },
      { cells: ['A3', 'A4'], operator: Operator.Plus, value: 5 },
      { cells: ['B3', 'B4'], operator: Operator.Plus, value: 5 },
      { cells: ['C3', 'C4'], operator: Operator.Plus, value: 5 },
      { cells: ['D3', 'D4'], operator: Operator.Plus, value: 5 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4]);
    }
    puzzle.getCell('A1').setValue(4);
    puzzle.getCell('B1').setValue(3);
    puzzle.getCell('D1').setValue(2);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const r = ensureNonNullable(result);
    const changes = r.changeGroups.flatMap((g) => g.changes);
    const valueChanges = changes.filter((c) => c instanceof ValueChange);
    expect(valueChanges.some((c) => c.cell.ref === 'C1' && c.value === 1)).toBe(true);
  });

  it('includes correct reason format for single cell', () => {
    const cages = [
      { cells: ['A1', 'A2'], operator: Operator.Plus, value: 3 },
      { cells: ['B1'], operator: Operator.Exact, value: 2 },
      { cells: ['C1'], operator: Operator.Exact, value: 3 },
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

  it('eliminates from single cell using bounded cage contribution', () => {
    // 4x4 puzzle. Row 1 total = 10
    // {A1} single=1 → known=1
    // {B1} single=2 → known=2
    // {C1,C2} 7+ — C2 unsolved, candidates {3,4} → inner min=7-4=3, max=7-3=4 → bounded
    // {D1,D2} 5+ — D2 unsolved, candidates {1,2} → inner min=5-2=3, max=5-1=4 → bounded
    // Path A: no truly unknown cells, Path B applies
    // BoundedCells = [C1, D1], knownSum = 1+2 = 3, remaining = 10-3 = 7
    // EliminateFromMultipleCells with 2 cells, remaining=7: otherCount=1, minOthers=1, maxOthers=4
    // MaxValue = 7-1 = 6 (>puzzleSize, no upper elimination), minValue = 7-4 = 3
    // Eliminate 1,2 from C1 and D1
    const cages = [
      { cells: ['A1'], operator: Operator.Exact, value: 1 },
      { cells: ['B1'], operator: Operator.Exact, value: 2 },
      { cells: ['C1', 'C2'], operator: Operator.Plus, value: 7 },
      { cells: ['D1', 'D2'], operator: Operator.Plus, value: 5 },
      { cells: ['A2', 'B2'], operator: Operator.Plus, value: 7 },
      { cells: ['A3', 'A4'], operator: Operator.Plus, value: 5 },
      { cells: ['B3', 'B4'], operator: Operator.Plus, value: 5 },
      { cells: ['C3', 'C4'], operator: Operator.Plus, value: 5 },
      { cells: ['D3', 'D4'], operator: Operator.Plus, value: 5 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4]);
    }
    puzzle.getCell('C2').setCandidates([3, 4]);
    puzzle.getCell('D2').setCandidates([1, 2]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const r = ensureNonNullable(result);
    const changes = r.changeGroups.flatMap((g) => g.changes);

    const c1Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'C1'
    ) as CandidatesStrikethrough[];
    expect(c1Changes.flatMap((c) => [...c.values])).toEqual([1, 2]);

    const d1Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'D1'
    ) as CandidatesStrikethrough[];
    expect(d1Changes.flatMap((c) => [...c.values])).toEqual([1, 2]);
  });

  it('bounded cage narrows single unknown cell via Path A', () => {
    // 4x4 puzzle. Column A total = 10
    // {A1,B1} 5+ — B1 solved=2 → known contribution = 5-2 = 3
    // {A2} single=2 → known=2
    // {A3,B3} 7+ — B3 unsolved, candidates {3,4} → inner min=7-4=3, max=7-3=4 → bounded
    // {A4,B4} 8x — non-plus → A4 truly unknown
    // KnownSum = 3+2 = 5, boundedMin=3, boundedMax=4
    // Path A: 1 unknown cell (A4), remainingMin = 10-5-4 = 1, remainingMax = 10-5-3 = 2
    // A4 has candidates {1,2,3,4} → eliminate 3,4
    const cages = [
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 5 },
      { cells: ['A2'], operator: Operator.Exact, value: 2 },
      { cells: ['A3', 'B3'], operator: Operator.Plus, value: 7 },
      { cells: ['A4', 'B4'], operator: Operator.Times, value: 8 },
      { cells: ['B2', 'C2'], operator: Operator.Plus, value: 5 },
      { cells: ['D2'], operator: Operator.Exact, value: 3 },
      { cells: ['C1', 'D1'], operator: Operator.Plus, value: 5 },
      { cells: ['C3', 'D3'], operator: Operator.Plus, value: 5 },
      { cells: ['C4', 'D4'], operator: Operator.Plus, value: 5 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4]);
    }
    puzzle.getCell('B1').setValue(2);
    puzzle.getCell('B3').setCandidates([3, 4]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const r = ensureNonNullable(result);
    const changes = r.changeGroups.flatMap((g) => g.changes);

    // Column A: A4 is the single unknown, bounded range [1,2] → eliminate 3,4
    const a4Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'A4'
    ) as CandidatesStrikethrough[];
    expect(a4Changes.flatMap((c) => [...c.values])).toEqual([3, 4]);
  });

  it('bounded single cell sets value when range is exact via Path B', () => {
    // 4x4 puzzle. Row 1 total = 10
    // {A1} single=1 → known=1
    // {B1} single=3 → known=3
    // {C1} single=4 → known=4
    // {D1,D2} 5+ — D2 unsolved, candidates {3} → inner min=5-3=2, max=5-3=2 → known
    // Wait, that's exact not bounded. Let me use Path B differently.
    //
    // Actually Path B sets value when remaining is exact and there's one bounded cell:
    // {A1} single=2 → known=2
    // {B1} single=3 → known=3
    // {C1} single=4 → known=4
    // {D1,D2} 5+ — D2 unsolved, candidates {3,4} → inner min=5-4=1, max=5-3=2 → bounded
    // Path B: knownSum=2+3+4=9, remaining=10-9=1, 1 bounded cell (D1)
    // EliminateSingleCellWithRange(D1, 1, 1, ...) → exact → D1=1
    const cages = [
      { cells: ['A1'], operator: Operator.Exact, value: 2 },
      { cells: ['B1'], operator: Operator.Exact, value: 3 },
      { cells: ['C1'], operator: Operator.Exact, value: 4 },
      { cells: ['D1', 'D2'], operator: Operator.Plus, value: 5 },
      { cells: ['A2', 'B2'], operator: Operator.Plus, value: 5 },
      { cells: ['C2'], operator: Operator.Exact, value: 3 },
      { cells: ['A3', 'A4'], operator: Operator.Plus, value: 5 },
      { cells: ['B3', 'B4'], operator: Operator.Plus, value: 5 },
      { cells: ['C3', 'C4'], operator: Operator.Plus, value: 5 },
      { cells: ['D3', 'D4'], operator: Operator.Plus, value: 5 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4]);
    }
    puzzle.getCell('D2').setCandidates([3, 4]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const r = ensureNonNullable(result);
    const changes = r.changeGroups.flatMap((g) => g.changes);
    const valueChanges = changes.filter((c) => c instanceof ValueChange);
    expect(valueChanges.some((c) => c.cell.ref === 'D1' && c.value === 1)).toBe(true);
  });

  it('uses bounded range notation in reason format', () => {
    // Same setup as 'bounded cage narrows single unknown cell via Path A'
    const cages = [
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 5 },
      { cells: ['A2'], operator: Operator.Exact, value: 2 },
      { cells: ['A3', 'B3'], operator: Operator.Plus, value: 7 },
      { cells: ['A4', 'B4'], operator: Operator.Times, value: 8 },
      { cells: ['B2', 'C2'], operator: Operator.Plus, value: 5 },
      { cells: ['D2'], operator: Operator.Exact, value: 3 },
      { cells: ['C1', 'D1'], operator: Operator.Plus, value: 5 },
      { cells: ['C3', 'D3'], operator: Operator.Plus, value: 5 },
      { cells: ['C4', 'D4'], operator: Operator.Plus, value: 5 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4]);
    }
    puzzle.getCell('B1').setValue(2);
    puzzle.getCell('B3').setCandidates([3, 4]);

    const result = ensureNonNullable(strategy.tryApply(puzzle));
    // Column A: A4 bounded range [1,2] → "column A 1..2 -3 -4"
    expect(result.details).toContain('column A 1..2 -3 -4');
  });

  it('combines multiple bounded cages', () => {
    // 4x4 puzzle. Row 1 total = 10
    // {A1,A2} 4+ — A2 unsolved, candidates {1,2} → inner min=4-2=2, max=4-1=3 → bounded
    // {B1,B2} 6+ — B2 unsolved, candidates {2,3} → inner min=6-3=3, max=6-2=4 → bounded
    // {C1} single=2 → known=2
    // {D1,D2} 8x — non-plus → D1 truly unknown
    // KnownSum = 2, boundedMin = 2+3 = 5, boundedMax = 3+4 = 7
    // Path A: 1 unknown cell (D1), remainingMin = 10-2-7 = 1, remainingMax = 10-2-5 = 3
    // D1 candidates {1,2,3,4} → eliminate 4
    const cages = [
      { cells: ['A1', 'A2'], operator: Operator.Plus, value: 4 },
      { cells: ['B1', 'B2'], operator: Operator.Plus, value: 6 },
      { cells: ['C1'], operator: Operator.Exact, value: 2 },
      { cells: ['D1', 'D2'], operator: Operator.Times, value: 8 },
      { cells: ['C2'], operator: Operator.Exact, value: 3 },
      { cells: ['A3', 'A4'], operator: Operator.Plus, value: 5 },
      { cells: ['B3', 'B4'], operator: Operator.Plus, value: 5 },
      { cells: ['C3', 'C4'], operator: Operator.Plus, value: 5 },
      { cells: ['D3', 'D4'], operator: Operator.Plus, value: 5 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 4 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2, 3, 4]);
    }
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B2').setCandidates([2, 3]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const r = ensureNonNullable(result);
    const changes = r.changeGroups.flatMap((g) => g.changes);

    const d1Changes = changes.filter(
      (c) => c instanceof CandidatesStrikethrough && c.cell.ref === 'D1'
    ) as CandidatesStrikethrough[];
    expect(d1Changes.flatMap((c) => [...c.values])).toEqual([4]);
  });
});
