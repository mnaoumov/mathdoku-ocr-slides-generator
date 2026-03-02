import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { CandidatesChange } from '../src/cellChanges/CandidatesChange.ts';
import { CandidatesStrikethrough } from '../src/cellChanges/CandidatesStrikethrough.ts';
import { CellClearance } from '../src/cellChanges/CellClearance.ts';
import { ValueChange } from '../src/cellChanges/ValueChange.ts';
import {
  initPuzzleSlides,
  Operator
} from '../src/Puzzle.ts';
import {
  createInitialStrategies,
  createStrategies
} from '../src/strategies/createDefaultStrategies.ts';
import {
  createTestPuzzle,
  TrackingRenderer
} from './puzzleTestHelper.ts';

// Valid 4x4 puzzle: solution is [[1,2,3,4],[2,1,4,3],[3,4,1,2],[4,3,2,1]]
const SIZE_4_CAGES = [
  { cells: ['A1', 'A2'], operator: Operator.Plus, value: 3 },
  { cells: ['B1', 'B2'], operator: Operator.Minus, value: 1 },
  { cells: ['A3', 'B3'], operator: Operator.Plus, value: 7 },
  { cells: ['A4', 'B4'], operator: Operator.Times, value: 12 },
  { cells: ['C1', 'C2'], operator: Operator.Plus, value: 7 },
  { cells: ['D1', 'D2'], operator: Operator.Minus, value: 1 },
  { cells: ['C3', 'D3'], operator: Operator.Plus, value: 3 },
  { cells: ['C4', 'D4'], operator: Operator.Times, value: 2 }
];

describe('Puzzle', () => {
  describe('constructor', () => {
    it('creates cells for all grid positions', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      expect(puzzle.cells).toHaveLength(16);
    });

    it('creates correct number of rows and columns', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      expect(puzzle.rows).toHaveLength(4);
      expect(puzzle.columns).toHaveLength(4);
    });

    it('creates houses combining rows and columns', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      expect(puzzle.houses).toHaveLength(8);
    });

    it('throws if cell is not in any cage', () => {
      const incompleteCages = [
        { cells: ['A1'], operator: Operator.Exact, value: 1 }
      ];
      expect(() => createTestPuzzle({ cages: incompleteCages, hasOperators: true, puzzleSize: 2 })).toThrow('not found in any cage');
    });
  });

  describe('getCell', () => {
    it('retrieves cell by ref string', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      const cell = puzzle.getCell('B3');
      expect(cell.ref).toBe('B3');
    });

    it('retrieves cell by row and column ids', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      const cell = puzzle.getCell(2, 3);
      expect(cell.ref).toBe('C2');
    });
  });

  describe('enter', () => {
    it('creates value change for =N', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      // Set up candidates directly
      for (const cell of puzzle.cells) {
        cell.setCandidates([1, 2, 3, 4]);
      }
      puzzle.enter('A1:=3');
      puzzle.commit();
      expect(puzzle.getCell('A1').value).toBe(3);
    });

    it('creates candidates change for digits', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      puzzle.enter('A1:123');
      puzzle.commit();
      expect(puzzle.getCell('A1').getCandidates()).toEqual([1, 2, 3]);
    });

    it('creates strikethrough change for -digits', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      // Set up candidates first
      puzzle.enter('A1:1234');
      puzzle.commit();
      puzzle.enter('A1:-34');
      puzzle.commit();
      expect(puzzle.getCell('A1').getCandidates()).toEqual([1, 2]);
    });

    it('creates clearance change for x', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      puzzle.enter('A1:=3');
      puzzle.commit();
      puzzle.enter('A1:x');
      puzzle.commit();
      expect(puzzle.getCell('A1').value).toBeNull();
      expect(puzzle.getCell('A1').getCandidates()).toEqual([]);
    });

    it('strips comment and executes command', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      puzzle.enter('A1:123 // setting candidates');
      puzzle.commit();
      expect(puzzle.getCell('A1').getCandidates()).toEqual([1, 2, 3]);
    });

    it('includes comment in note text', () => {
      const renderer = new TrackingRenderer();
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4, renderer });
      puzzle.enter('A1:123 // setting candidates');
      puzzle.commit();
      const noted = renderer.notesBySlide.filter((n) => n === 'A1:123 // setting candidates');
      expect(noted).toHaveLength(2);
    });

    it('throws for comment-only input', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      expect(() => {
        puzzle.enter('// just a comment');
      }).toThrow('No commands specified');
    });

    it('throws for empty input', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      expect(() => {
        puzzle.enter('');
      }).toThrow('No commands specified');
    });

    it('throws for invalid format', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      expect(() => {
        puzzle.enter('invalid');
      }).toThrow('Invalid format');
    });
  });

  describe('enter cell selection syntax', () => {
    it('(Row N) targets all cells in that row', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      puzzle.enter('(Row 1):1234');
      puzzle.commit();
      expect(puzzle.getCell('A1').getCandidates()).toEqual([1, 2, 3, 4]);
      expect(puzzle.getCell('B1').getCandidates()).toEqual([1, 2, 3, 4]);
      expect(puzzle.getCell('C1').getCandidates()).toEqual([1, 2, 3, 4]);
      expect(puzzle.getCell('D1').getCandidates()).toEqual([1, 2, 3, 4]);
      expect(puzzle.getCell('A2').getCandidates()).toEqual([]);
    });

    it('(Column X) targets all cells in that column', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      puzzle.enter('(Column A):1234');
      puzzle.commit();
      expect(puzzle.getCell('A1').getCandidates()).toEqual([1, 2, 3, 4]);
      expect(puzzle.getCell('A2').getCandidates()).toEqual([1, 2, 3, 4]);
      expect(puzzle.getCell('A3').getCandidates()).toEqual([1, 2, 3, 4]);
      expect(puzzle.getCell('A4').getCandidates()).toEqual([1, 2, 3, 4]);
      expect(puzzle.getCell('B1').getCandidates()).toEqual([]);
    });

    it('(A1..B2) targets rectangular range', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      puzzle.enter('(A1..B2):12');
      puzzle.commit();
      expect(puzzle.getCell('A1').getCandidates()).toEqual([1, 2]);
      expect(puzzle.getCell('B1').getCandidates()).toEqual([1, 2]);
      expect(puzzle.getCell('A2').getCandidates()).toEqual([1, 2]);
      expect(puzzle.getCell('B2').getCandidates()).toEqual([1, 2]);
      expect(puzzle.getCell('C1').getCandidates()).toEqual([]);
    });

    it('(D4..A3) range works in reverse order', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      puzzle.enter('(D4..A3):12');
      puzzle.commit();
      expect(puzzle.getCell('A3').getCandidates()).toEqual([1, 2]);
      expect(puzzle.getCell('D4').getCandidates()).toEqual([1, 2]);
      expect(puzzle.getCell('B3').getCandidates()).toEqual([1, 2]);
      expect(puzzle.getCell('C4').getCandidates()).toEqual([1, 2]);
    });

    it('(@A3-B3) targets cage minus one cell', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      // Cage containing A3 = [A3, B3]
      puzzle.enter('(@A3-B3):12');
      puzzle.commit();
      expect(puzzle.getCell('A3').getCandidates()).toEqual([1, 2]);
      expect(puzzle.getCell('B3').getCandidates()).toEqual([]);
    });

    it('(@A1-(A2)) targets cage minus multiple cells', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      // Cage containing A1 = [A1, A2], excluding A2 → only A1
      puzzle.enter('(@A1-(A2)):12');
      puzzle.commit();
      expect(puzzle.getCell('A1').getCandidates()).toEqual([1, 2]);
      expect(puzzle.getCell('A2').getCandidates()).toEqual([]);
    });

    it('Row and Column are case-insensitive', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      puzzle.enter('(row 1):12 (COLUMN D):34');
      puzzle.commit();
      expect(puzzle.getCell('A1').getCandidates()).toEqual([1, 2]);
      // D1 is in both row 1 and column D; second command overwrites
      expect(puzzle.getCell('D1').getCandidates()).toEqual([3, 4]);
      expect(puzzle.getCell('D3').getCandidates()).toEqual([3, 4]);
    });

    it('throws for invalid row number', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      expect(() => {
        puzzle.enter('(Row 5):12');
      }).toThrow();
    });
  });
});

describe('Cell', () => {
  it('tracks candidates correctly', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
    const cell = puzzle.getCell('A1');
    cell.setCandidates([1, 2, 3]);
    expect(cell.getCandidates()).toEqual([1, 2, 3]);
    expect(cell.hasCandidate(2)).toBe(true);
    expect(cell.hasCandidate(4)).toBe(false);
    cell.removeCandidate(2);
    expect(cell.getCandidates()).toEqual([1, 3]);
  });

  it('tracks value correctly', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
    const cell = puzzle.getCell('A1');
    expect(cell.isSolved).toBe(false);
    expect(cell.value).toBeNull();
    cell.setValue(3);
    expect(cell.isSolved).toBe(true);
    expect(cell.value).toBe(3);
    cell.clearValue();
    expect(cell.isSolved).toBe(false);
  });

  it('has correct peers (row + column, excluding self)', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
    const cell = puzzle.getCell('B2');
    // Row 2: A2, C2, D2 (3 peers) + Column B: B1, B3, B4 (3 peers) = 6
    expect(cell.peers).toHaveLength(6);
  });
});

describe('tryApplyOneStrategyStep', () => {
  const SIZE_2_CAGES = [
    { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
    { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
  ];

  it('returns { applied: false } when no strategies match', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2]);
    }
    const result = puzzle.tryApplyOneStrategyStep(createStrategies(2));
    expect(result.applied).toBe(false);
    expect(result.message).toBeUndefined();
    expect(result.slideNumber).toBe(1);
    expect(result.skipped).toEqual([
      'Single candidate',
      'Hidden single',
      'Last cell in cage',
      'Too small for sum',
      'Too big for sum',
      'Doesn\'t divide product',
      'Too small for product',
      'Too big for product',
      'Determined by cage',
      'No cage combination',
      'Required cage candidate',
      'Innies/Outies'
    ]);
  });

  it('applies first matching strategy and returns message', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2 });
    puzzle.getCell('A1').setCandidates([1]);
    puzzle.getCell('B1').setCandidates([1, 2]);
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B2').setCandidates([1, 2]);

    const result = puzzle.tryApplyOneStrategyStep(createStrategies(2));
    expect(result.applied).toBe(true);
    expect(result.message).toContain('Single candidate');
    expect(result.slideNumber).toBe(3);
    expect(result.skipped).toEqual([]);
    expect(puzzle.getCell('A1').value).toBe(1);
  });

  it('applies only one step per call', () => {
    const renderer = new TrackingRenderer();
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });
    puzzle.getCell('A1').setCandidates([1]);
    puzzle.getCell('B1').setCandidates([2]);
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B2').setCandidates([1, 2]);

    const strategies = createStrategies(2);
    const result1 = puzzle.tryApplyOneStrategyStep(strategies);
    expect(result1.applied).toBe(true);
    expect(result1.slideNumber).toBe(3);

    const result2 = puzzle.tryApplyOneStrategyStep(strategies);
    expect(result2.applied).toBe(true);
    expect(result2.slideNumber).toBe(5);
  });

  it('records note text for the step', () => {
    const renderer = new TrackingRenderer();
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });
    puzzle.getCell('A1').setCandidates([1]);
    puzzle.getCell('B1').setCandidates([1, 2]);
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B2').setCandidates([1, 2]);

    puzzle.tryApplyOneStrategyStep(createStrategies(2));
    const strategyNotes = renderer.notesBySlide.filter((n) => n.startsWith('Single candidate'));
    expect(strategyNotes).toHaveLength(2);
  });
});

describe('tryApplyAutomatedStrategies', () => {
  const SIZE_2_CAGES = [
    { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
    { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
  ];

  it('returns false when no strategies apply', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, strategies: createStrategies(2) });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2]);
    }
    expect(puzzle.tryApplyAutomatedStrategies()).toBe(false);
  });

  it('applies single candidate strategy and returns true', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, strategies: createStrategies(2) });
    puzzle.getCell('A1').setCandidates([1]);
    puzzle.getCell('B1').setCandidates([1, 2]);
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B2').setCandidates([1, 2]);

    expect(puzzle.tryApplyAutomatedStrategies()).toBe(true);
    expect(puzzle.getCell('A1').value).toBe(1);
  });

  it('chains multiple strategy steps until no more apply', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, strategies: createStrategies(2) });
    // A1 has single candidate → solved → peers lose that candidate → chain
    puzzle.getCell('A1').setCandidates([1]);
    puzzle.getCell('B1').setCandidates([2]);
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B2').setCandidates([1, 2]);

    puzzle.tryApplyAutomatedStrategies();
    // All cells should be solved
    for (const cell of puzzle.cells) {
      expect(cell.isSolved).toBe(true);
    }
  });
});

describe('ensureLastSlide guard', () => {
  const SIZE_2_CAGES = [
    { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
    { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
  ];

  it('enter does nothing when not on last slide', () => {
    const renderer = new TrackingRenderer();
    renderer.isLastSlide = false;
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });
    puzzle.enter('A1:12');
    expect(puzzle.getCell('A1').getCandidates()).toEqual([]);
    expect(renderer.slideCount).toBe(1);
  });

  it('tryApplyAutomatedStrategies returns false when not on last slide', () => {
    const renderer = new TrackingRenderer();
    renderer.isLastSlide = false;
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer, strategies: createStrategies(2) });
    puzzle.getCell('A1').setCandidates([1]);
    puzzle.getCell('B1').setCandidates([1, 2]);
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B2').setCandidates([1, 2]);

    expect(puzzle.tryApplyAutomatedStrategies()).toBe(false);
    expect(puzzle.getCell('A1').value).toBeNull();
  });
});

describe('slide notes tracking', () => {
  const SIZE_2_CAGES = [
    { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
    { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
  ];

  it('records note text on both pending and committed slides for enter+commit', () => {
    const renderer = new TrackingRenderer();
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });
    // Set up candidates directly
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2]);
    }

    puzzle.enter('A1:=1');
    puzzle.commit();

    // Both the pending slide and committed slide should have the note
    const notedSlides = renderer.notesBySlide.filter((n) => n === 'A1:=1');
    expect(notedSlides).toHaveLength(2);
  });

  it('records strategy-specific note for each strategy step', () => {
    const renderer = new TrackingRenderer();
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer, strategies: createStrategies(2) });
    puzzle.getCell('A1').setCandidates([1]);
    puzzle.getCell('B1').setCandidates([2]);
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B2').setCandidates([1, 2]);

    puzzle.tryApplyAutomatedStrategies();

    // 2 strategy steps, each producing 2 slides (pending + committed) with strategy-specific notes
    const strategyNotes = renderer.notesBySlide.filter((n) => n.startsWith('Single candidate:'));
    expect(strategyNotes).toHaveLength(4);
  });

  it('records different notes for different operations', () => {
    const renderer = new TrackingRenderer();
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });

    puzzle.enter('A1:12');
    puzzle.commit();

    puzzle.enter('B1:12');
    puzzle.commit();

    const batch1Notes = renderer.notesBySlide.filter((n) => n === 'A1:12');
    const batch2Notes = renderer.notesBySlide.filter((n) => n === 'B1:12');
    expect(batch1Notes).toHaveLength(2);
    expect(batch2Notes).toHaveLength(2);
  });
});

describe('initPuzzleSlides notes', () => {
  it('first strategy note is Filling all candidates', () => {
    const renderer = new TrackingRenderer();
    initPuzzleSlides({
      cages: SIZE_4_CAGES,
      hasOperators: true,
      initialStrategies: createInitialStrategies(),
      puzzleSize: 4,
      renderer,
      strategies: createStrategies(4)
    });

    expect(renderer.notesBySlide[0]).toBe('Filling all candidates');
    expect(renderer.notesBySlide[1]).toBe('Filling all candidates');
  });

  it('produces at least 3 slides when init strategies apply', () => {
    const renderer = new TrackingRenderer();
    initPuzzleSlides({
      cages: SIZE_4_CAGES,
      hasOperators: true,
      initialStrategies: createInitialStrategies(),
      puzzleSize: 4,
      renderer,
      strategies: createStrategies(4)
    });

    // At least FillAllCandidates fires → 1 initial + 1×2 = 3 slides minimum
    expect(renderer.slideCount).toBeGreaterThanOrEqual(3);
  });

  it('produces 3 slides when only FillAllCandidates fires', () => {
    const cages = [
      { cells: ['A1', 'B1'], operator: Operator.Unknown, value: 3 },
      { cells: ['A2', 'B2'], operator: Operator.Unknown, value: 3 }
    ];
    const renderer = new TrackingRenderer();
    initPuzzleSlides({
      cages,
      hasOperators: false,
      initialStrategies: createInitialStrategies(),
      puzzleSize: 2,
      renderer,
      strategies: createStrategies(2)
    });

    expect(renderer.slideCount).toBe(3);
    expect(renderer.notesBySlide[0]).toBe('Filling all candidates');
    expect(renderer.notesBySlide[1]).toBe('Filling all candidates');
    expect(renderer.notesBySlide[2]).toBeUndefined();
  });
});

describe('enter validation', () => {
  it('throws when value exceeds puzzle size', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
    expect(() => {
      puzzle.enter('A1:=5');
    }).toThrow('Value 5 exceeds puzzle size 4');
  });

  it('throws when candidate exceeds puzzle size', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
    expect(() => {
      puzzle.enter('A1:125');
    }).toThrow('Value 5 exceeds puzzle size 4');
  });

  it('throws when strikethrough value exceeds puzzle size', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
    expect(() => {
      puzzle.enter('A1:-56');
    }).toThrow('Value 5 exceeds puzzle size 4');
  });

  it('throws when value conflicts with peer', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('B1').setValue(3);
    expect(() => {
      puzzle.enter('A1:=3');
    }).toThrow('A1 = 3 conflicts with B1 which is already 3');
  });

  it('throws when value makes completed cage invalid', () => {
    // Cage {A1, A2} +3, cells in same column so no peer conflict with different values
    const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setValue(1);
    // A1=1, setting A2=4 → sum=5≠3, cage invalid
    expect(() => {
      puzzle.enter('A2:=4');
    }).toThrow('makes cage @A1 invalid');
  });

  it('allows valid value that completes cage correctly', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
    puzzle.getCell('A1').setValue(1);
    // A1=1, setting A2=2 → sum=3 ✓
    expect(() => {
      puzzle.enter('A2:=2');
    }).not.toThrow();
  });
});

describe('renderer calls', () => {
  const SIZE_2_CAGES = [
    { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
    { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
  ];

  it('enter + commit with value calls renderPendingValue with ValueChange', () => {
    const renderer = new TrackingRenderer();
    const captured: ValueChange[] = [];
    vi.spyOn(renderer, 'renderPendingValue').mockImplementation((change: ValueChange) => {
      captured.push(change);
    });
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2]);
    }

    puzzle.enter('A1:=1');
    puzzle.commit();

    expect(captured).toHaveLength(1);
    expect(captured[0]).toBeInstanceOf(ValueChange);
    expect(captured[0]?.cell.ref).toBe('A1');
    expect(captured[0]?.value).toBe(1);
  });

  it('enter + commit with candidates calls renderPendingCandidates with CandidatesChange', () => {
    const renderer = new TrackingRenderer();
    const captured: CandidatesChange[] = [];
    vi.spyOn(renderer, 'renderPendingCandidates').mockImplementation((change: CandidatesChange) => {
      captured.push(change);
    });
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });

    puzzle.enter('A1:12');
    puzzle.commit();

    expect(captured).toHaveLength(1);
    expect(captured[0]).toBeInstanceOf(CandidatesChange);
    expect(captured[0]?.cell.ref).toBe('A1');
    expect(captured[0]?.values).toEqual([1, 2]);
  });

  it('enter + commit with strikethrough calls renderPendingStrikethrough', () => {
    const renderer = new TrackingRenderer();
    const captured: CandidatesStrikethrough[] = [];
    vi.spyOn(renderer, 'renderPendingStrikethrough').mockImplementation((change: CandidatesStrikethrough) => {
      captured.push(change);
    });
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });
    puzzle.getCell('A1').setCandidates([1, 2]);

    puzzle.enter('A1:-2');
    puzzle.commit();

    const a1Changes = captured.filter((change) => change.cell.ref === 'A1');
    expect(a1Changes).toHaveLength(1);
    expect(a1Changes[0]).toBeInstanceOf(CandidatesStrikethrough);
    expect(a1Changes[0]?.values).toEqual([2]);
  });

  it('enter + commit with clear calls renderPendingClearance', () => {
    const renderer = new TrackingRenderer();
    const captured: CellClearance[] = [];
    vi.spyOn(renderer, 'renderPendingClearance').mockImplementation((change: CellClearance) => {
      captured.push(change);
    });
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });
    puzzle.getCell('A1').setCandidates([1, 2]);

    puzzle.enter('A1:x');
    puzzle.commit();

    expect(captured).toHaveLength(1);
    expect(captured[0]).toBeInstanceOf(CellClearance);
    expect(captured[0]?.cell.ref).toBe('A1');
  });

  it('beginPendingRender is called before renderPending*, renderCommittedChanges after commit', () => {
    const renderer = new TrackingRenderer();
    const callOrder: string[] = [];
    vi.spyOn(renderer, 'beginPendingRender').mockImplementation(() => {
      callOrder.push('beginPendingRender');
    });
    vi.spyOn(renderer, 'renderPendingCandidates').mockImplementation(() => {
      callOrder.push('renderPendingCandidates');
    });
    vi.spyOn(renderer, 'renderCommittedChanges').mockImplementation(() => {
      callOrder.push('renderCommittedChanges');
    });
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });

    puzzle.enter('A1:12');
    puzzle.commit();

    expect(callOrder).toEqual([
      'beginPendingRender',
      'renderPendingCandidates',
      'renderCommittedChanges'
    ]);
  });

  it('multi-cell command calls renderPendingCandidates for each cell', () => {
    const renderer = new TrackingRenderer();
    const captured: CandidatesChange[] = [];
    vi.spyOn(renderer, 'renderPendingCandidates').mockImplementation((change: CandidatesChange) => {
      captured.push(change);
    });
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });

    puzzle.enter('A1:12 B1:12');
    puzzle.commit();

    expect(captured).toHaveLength(2);
    expect(captured[0]?.cell.ref).toBe('A1');
    expect(captured[1]?.cell.ref).toBe('B1');
  });

  it('tryApplyOneStrategyStep calls beginPendingRender, renderPendingValue, renderCommittedChanges', () => {
    const renderer = new TrackingRenderer();
    const beginSpy = vi.spyOn(renderer, 'beginPendingRender');
    const valueSpy = vi.spyOn(renderer, 'renderPendingValue');
    const commitSpy = vi.spyOn(renderer, 'renderCommittedChanges');
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });
    puzzle.getCell('A1').setCandidates([1]);
    puzzle.getCell('B1').setCandidates([1, 2]);
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B2').setCandidates([1, 2]);

    puzzle.tryApplyOneStrategyStep(createStrategies(2));

    expect(beginSpy).toHaveBeenCalled();
    expect(valueSpy).toHaveBeenCalled();
    expect(commitSpy).toHaveBeenCalled();
  });

  it('enter returns early when ensureLastSlide is false — beginPendingRender not called', () => {
    const renderer = new TrackingRenderer();
    renderer.isLastSlide = false;
    const beginSpy = vi.spyOn(renderer, 'beginPendingRender');
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });

    puzzle.enter('A1:12');

    expect(beginSpy).not.toHaveBeenCalled();
  });

  it('restoreCellStates is callable with puzzle cells', () => {
    const renderer = new TrackingRenderer();
    const spy = vi.spyOn(renderer, 'restoreCellStates');
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });

    renderer.restoreCellStates(puzzle.cells);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(puzzle.cells);
  });
});

describe('CellChange subclasses', () => {
  it('CandidatesChange sets candidates and clears value', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
    const cell = puzzle.getCell('A1');
    cell.setValue(5);
    const change = new CandidatesChange(cell, [1, 2, 3]);
    change.applyToModel();
    expect(cell.getCandidates()).toEqual([1, 2, 3]);
    expect(cell.value).toBeNull();
  });

  it('CandidatesStrikethrough removes specific candidates', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
    const cell = puzzle.getCell('A1');
    cell.setCandidates([1, 2, 3, 4]);
    const change = new CandidatesStrikethrough(cell, [2, 4]);
    change.applyToModel();
    expect(cell.getCandidates()).toEqual([1, 3]);
  });

  it('CellClearance clears value and candidates', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
    const cell = puzzle.getCell('A1');
    cell.setValue(5);
    cell.setCandidates([1, 2]);
    const change = new CellClearance(cell);
    change.applyToModel();
    expect(cell.value).toBeNull();
    expect(cell.getCandidates()).toEqual([]);
  });

  it('ValueChange sets value and clears candidates', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
    const cell = puzzle.getCell('A1');
    cell.setCandidates([1, 2, 3]);
    const change = new ValueChange(cell, 5);
    change.applyToModel();
    expect(cell.value).toBe(5);
    expect(cell.getCandidates()).toEqual([]);
  });
});
