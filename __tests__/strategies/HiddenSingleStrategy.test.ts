import {
  describe,
  expect,
  it
} from 'vitest';

import { ValueChange } from '../../src/cellChanges/ValueChange.ts';
import { Operator } from '../../src/Puzzle.ts';
import { HiddenSingleStrategy } from '../../src/strategies/HiddenSingleStrategy.ts';
import { ensureNonNullable } from '../../src/typeGuards.ts';
import { createTestPuzzle } from '../puzzleTestHelper.ts';

describe('HiddenSingleStrategy', () => {
  const strategy = new HiddenSingleStrategy();

  it('returns null when no hidden singles exist', () => {
    const cages = [
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
      { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 2 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2]);
    }
    expect(strategy.tryApply(puzzle)).toBeNull();
  });

  it('finds hidden single when digit appears in only one cell in a house', () => {
    const cages = [
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
      { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 2 });
    puzzle.getCell('A1').setCandidates([1, 2]);
    puzzle.getCell('B1').setCandidates([2]);
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B2').setCandidates([1, 2]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
    const r = ensureNonNullable(result);
    const changes = r.changeGroups.flatMap((g) => g.changes);
    const valueChanges = changes.filter((c) => c instanceof ValueChange);
    expect(valueChanges.some((c) => c.cell.ref === 'A1' && c.value === 1)).toBe(true);
    expect(r.details).toContain('A1');
  });

  it('skips solved cells', () => {
    const cages = [
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
      { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 2 });
    puzzle.getCell('A1').setValue(1);
    puzzle.getCell('B1').setCandidates([2]);
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B2').setCandidates([1, 2]);

    const result = strategy.tryApply(puzzle);
    expect(result).not.toBeNull();
  });
});
