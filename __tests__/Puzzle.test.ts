import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { CandidatesChange } from '../src/cellChanges/CandidatesChange.ts';
import { CandidatesStrikethrough } from '../src/cellChanges/CandidatesStrikethrough.ts';
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

  describe('applyChanges + commit', () => {
    it('sets value via ValueChange', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      for (const cell of puzzle.cells) {
        cell.setCandidates([1, 2, 3, 4]);
      }
      puzzle.applyChanges([new ValueChange(puzzle.getCell('A1'), 3)]);
      puzzle.commit();
      expect(puzzle.getCell('A1').value).toBe(3);
    });

    it('sets candidates via CandidatesChange', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      puzzle.applyChanges([new CandidatesChange(puzzle.getCell('A1'), [1, 2, 3])]);
      puzzle.commit();
      expect(puzzle.getCell('A1').getCandidates()).toEqual([1, 2, 3]);
    });

    it('eliminates candidates via CandidatesStrikethrough', () => {
      const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4 });
      puzzle.getCell('A1').setCandidates([1, 2, 3, 4]);
      puzzle.applyChanges([new CandidatesStrikethrough(puzzle.getCell('A1'), [3, 4])]);
      puzzle.commit();
      expect(puzzle.getCell('A1').getCandidates()).toEqual([1, 2]);
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
    expect(strategyNotes).toHaveLength(1);
  });

  it('records command for the step', () => {
    const renderer = new TrackingRenderer();
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });
    puzzle.getCell('A1').setCandidates([1]);
    puzzle.getCell('B1').setCandidates([1, 2]);
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B2').setCandidates([1, 2]);

    puzzle.tryApplyOneStrategyStep(createStrategies(2));
    const commands = renderer.commandsBySlide.filter((c) => Object.keys(c).length > 0);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toHaveProperty('A1', '=1');
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

  it('records strategy-specific note for each strategy step', () => {
    const renderer = new TrackingRenderer();
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer, strategies: createStrategies(2) });
    puzzle.getCell('A1').setCandidates([1]);
    puzzle.getCell('B1').setCandidates([2]);
    puzzle.getCell('A2').setCandidates([1, 2]);
    puzzle.getCell('B2').setCandidates([1, 2]);

    puzzle.tryApplyAutomatedStrategies();

    // 2 strategy steps, each producing notes only on the pending slide
    const strategyNotes = renderer.notesBySlide.filter((n) => n.startsWith('Single candidate:'));
    expect(strategyNotes).toHaveLength(2);
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
    expect(renderer.notesBySlide[1]).toBeUndefined();
  });

  it('records command for FillAllCandidates strategy', () => {
    const renderer = new TrackingRenderer();
    initPuzzleSlides({
      cages: SIZE_4_CAGES,
      hasOperators: true,
      initialStrategies: createInitialStrategies(),
      puzzleSize: 4,
      renderer,
      strategies: createStrategies(4)
    });

    const commands = renderer.commandsBySlide.filter((c) => Object.keys(c).length > 0);
    expect(commands.length).toBeGreaterThanOrEqual(1);
  });
});

describe('renderer calls', () => {
  const SIZE_2_CAGES = [
    { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
    { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
  ];

  it('applyChanges + commit with value calls renderPendingValue with ValueChange', () => {
    const renderer = new TrackingRenderer();
    const captured: ValueChange[] = [];
    vi.spyOn(renderer, 'renderPendingValue').mockImplementation((change: ValueChange) => {
      captured.push(change);
    });
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2]);
    }

    puzzle.applyChanges([new ValueChange(puzzle.getCell('A1'), 1)]);
    puzzle.commit();

    expect(captured).toHaveLength(1);
    expect(captured[0]).toBeInstanceOf(ValueChange);
    expect(captured[0]?.cell.ref).toBe('A1');
    expect(captured[0]?.value).toBe(1);
  });

  it('applyChanges + commit with candidates calls renderPendingCandidates with CandidatesChange', () => {
    const renderer = new TrackingRenderer();
    const captured: CandidatesChange[] = [];
    vi.spyOn(renderer, 'renderPendingCandidates').mockImplementation((change: CandidatesChange) => {
      captured.push(change);
    });
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });

    puzzle.applyChanges([new CandidatesChange(puzzle.getCell('A1'), [1, 2])]);
    puzzle.commit();

    expect(captured).toHaveLength(1);
    expect(captured[0]).toBeInstanceOf(CandidatesChange);
    expect(captured[0]?.cell.ref).toBe('A1');
    expect(captured[0]?.values).toEqual([1, 2]);
  });

  it('applyChanges + commit with strikethrough calls renderPendingStrikethrough', () => {
    const renderer = new TrackingRenderer();
    const captured: CandidatesStrikethrough[] = [];
    vi.spyOn(renderer, 'renderPendingStrikethrough').mockImplementation((change: CandidatesStrikethrough) => {
      captured.push(change);
    });
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });
    puzzle.getCell('A1').setCandidates([1, 2]);

    puzzle.applyChanges([new CandidatesStrikethrough(puzzle.getCell('A1'), [2])]);
    puzzle.commit();

    const a1Changes = captured.filter((change) => change.cell.ref === 'A1');
    expect(a1Changes).toHaveLength(1);
    expect(a1Changes[0]).toBeInstanceOf(CandidatesStrikethrough);
    expect(a1Changes[0]?.values).toEqual([2]);
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

    puzzle.applyChanges([new CandidatesChange(puzzle.getCell('A1'), [1, 2])]);
    puzzle.commit();

    expect(callOrder).toEqual([
      'beginPendingRender',
      'renderPendingCandidates',
      'renderCommittedChanges'
    ]);
  });

  it('multi-cell applyChanges calls renderPendingCandidates for each cell', () => {
    const renderer = new TrackingRenderer();
    const captured: CandidatesChange[] = [];
    vi.spyOn(renderer, 'renderPendingCandidates').mockImplementation((change: CandidatesChange) => {
      captured.push(change);
    });
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });

    puzzle.applyChanges([
      new CandidatesChange(puzzle.getCell('A1'), [1, 2]),
      new CandidatesChange(puzzle.getCell('B1'), [1, 2])
    ]);
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

  it('dropped candidates rendered as strikethrough when setting new candidates', () => {
    const renderer = new TrackingRenderer();
    const candidateChanges: CandidatesChange[] = [];
    const strikethroughChanges: CandidatesStrikethrough[] = [];
    vi.spyOn(renderer, 'renderPendingCandidates').mockImplementation((change: CandidatesChange) => {
      candidateChanges.push(change);
    });
    vi.spyOn(renderer, 'renderPendingStrikethrough').mockImplementation((change: CandidatesStrikethrough) => {
      strikethroughChanges.push(change);
    });
    const puzzle = createTestPuzzle({ cages: SIZE_4_CAGES, hasOperators: true, puzzleSize: 4, renderer });
    puzzle.getCell('A1').setCandidates([1, 2, 3, 4]);

    puzzle.applyChanges([new CandidatesChange(puzzle.getCell('A1'), [1, 2])]);
    puzzle.commit();

    const a1Candidates = candidateChanges.filter((c) => c.cell.ref === 'A1');
    expect(a1Candidates).toHaveLength(1);
    expect(a1Candidates[0]?.values).toEqual([1, 2, 3, 4]);

    const a1Strikethrough = strikethroughChanges.filter((c) => c.cell.ref === 'A1');
    expect(a1Strikethrough).toHaveLength(1);
    expect(a1Strikethrough[0]?.values).toContain(3);
    expect(a1Strikethrough[0]?.values).toContain(4);

    expect(puzzle.getCell('A1').getCandidates()).toEqual([1, 2]);
  });

  it('no dropped strikethrough on fresh cell', () => {
    const renderer = new TrackingRenderer();
    const strikethroughChanges: CandidatesStrikethrough[] = [];
    vi.spyOn(renderer, 'renderPendingStrikethrough').mockImplementation((change: CandidatesStrikethrough) => {
      strikethroughChanges.push(change);
    });
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2, renderer });

    puzzle.applyChanges([new CandidatesChange(puzzle.getCell('A1'), [1, 2])]);
    puzzle.commit();

    const a1Strikethrough = strikethroughChanges.filter((c) => c.cell.ref === 'A1');
    expect(a1Strikethrough).toHaveLength(0);
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
