import {
  describe,
  expect,
  it
} from 'vitest';

import {
  collectCageTuples,
  computeValidCageTuples
} from '../src/cageConstraints.ts';
import { Operator } from '../src/Puzzle.ts';
import { createTestPuzzle } from './puzzleTestHelper.ts';

describe('computeValidCageTuples', () => {
  it('computes addition tuples for a 2-cell cage', () => {
    const cages = [
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
      { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 2 });
    const cage = puzzle.getCage(1);
    const tuples = computeValidCageTuples({ cells: cage.cells, operator: Operator.Plus, puzzleSize: 2, value: 3 });
    expect(tuples).toEqual([[1, 2], [2, 1]]);
  });

  it('computes multiplication tuples for a 2-cell cage', () => {
    const cages = [
      { cells: ['A1', 'B1'], operator: Operator.Times, value: 6 },
      { cells: ['A2', 'B2'], operator: Operator.Times, value: 6 },
      { cells: ['A3', 'B3'], operator: Operator.Plus, value: 5 },
      { cells: ['C1', 'C2', 'C3'], operator: Operator.Plus, value: 6 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 3 });
    const cage = puzzle.getCage(1);
    const tuples = computeValidCageTuples({ cells: cage.cells, operator: Operator.Times, puzzleSize: 3, value: 6 });
    expect(tuples).toEqual([[2, 3], [3, 2]]);
  });

  it('respects row/column constraints between cells', () => {
    const cages = [
      { cells: ['A1', 'A2'], operator: Operator.Plus, value: 3 },
      { cells: ['B1', 'B2'], operator: Operator.Plus, value: 3 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 2 });
    const cage = puzzle.getCage(1);
    // A1 and A2 are in the same column, so they can't have the same value
    const tuples = computeValidCageTuples({ cells: cage.cells, operator: Operator.Plus, puzzleSize: 2, value: 2 });
    // [1,1] would violate column constraint
    expect(tuples).toEqual([]);
  });
});

describe('collectCageTuples', () => {
  it('uses specified operator when hasOperators is true', () => {
    const cages = [
      { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
      { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: true, puzzleSize: 2 });
    const cage = puzzle.getCage(1);
    const tuples = collectCageTuples(3, { cage, hasOperators: true, puzzleSize: 2 });
    expect(tuples).toEqual([[1, 2], [2, 1]]);
  });

  it('tries all operators when hasOperators is false', () => {
    const cages = [
      { cells: ['A1', 'B1'], operator: Operator.Unknown, value: 3 },
      { cells: ['A2', 'B2'], operator: Operator.Unknown, value: 3 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: false, puzzleSize: 2 });
    const cage = puzzle.getCage(1);
    const tuples = collectCageTuples(3, { cage, hasOperators: false, puzzleSize: 2 });
    // + gives (1,2),(2,1); - gives (1,2) doesn't work (|1-2|=1≠3), but for size 2 nothing else
    // X gives nothing (1*2=2≠3, 2*1=2≠3); / gives nothing
    // So only + tuples: [1,2],[2,1]
    expect(tuples).toEqual([[1, 2], [2, 1]]);
  });

  it('deduplicates tuples across operators', () => {
    const cages = [
      { cells: ['A1', 'B1'], operator: Operator.Unknown, value: 2 },
      { cells: ['A2', 'B2'], operator: Operator.Unknown, value: 2 }
    ];
    const puzzle = createTestPuzzle({ cages, hasOperators: false, puzzleSize: 2 });
    const cage = puzzle.getCage(1);
    const tuples = collectCageTuples(2, { cage, hasOperators: false, puzzleSize: 2 });
    // + gives nothing (1+1=2 but same column); - gives (1,2)→|diff|≠2 in size 2...
    // Actually: - means |a-b|=2, with size 2: |1-2|=1≠2, |2-1|=1≠2 → nothing
    // X gives (1,2)→2, (2,1)→2 → both valid
    // / gives (1,2)→0.5≠2, (2,1)→2 → [2,1] valid
    // So [1,2],[2,1] from x, and [2,1] from / (but already seen)
    const keys = tuples.map((t) => t.join(','));
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(tuples.length);
  });
});
