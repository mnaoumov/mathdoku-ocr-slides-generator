import {
  describe,
  expect,
  it
} from 'vitest';

import { CandidatesChange } from '../src/cellChanges/CandidatesChange.ts';
import { CandidatesStrikethrough } from '../src/cellChanges/CandidatesStrikethrough.ts';
import { ValueChange } from '../src/cellChanges/ValueChange.ts';
import {
  initPuzzleSlides,
  Operator,
  parsePuzzleJson
} from '../src/Puzzle.ts';
import { buildCommand } from '../src/solutionCommand.ts';
import {
  buildSolutionYaml,
  parseSolutionYaml,
  puzzleJsonFromSolution,
  replaySolution,
  resolveCommand
} from '../src/SolutionYaml.ts';
import {
  createInitialStrategies,
  createStrategies
} from '../src/strategies/createDefaultStrategies.ts';
import { SvgRenderer } from '../src/SvgRenderer.ts';
import { createTestPuzzle } from './puzzleTestHelper.ts';

const SIZE_4_PUZZLE_JSON = parsePuzzleJson({
  cages: [
    { cells: ['A1', 'A2'], operator: '+', value: 3 },
    { cells: ['B1', 'B2'], operator: '-', value: 1 },
    { cells: ['A3', 'B3'], operator: '+', value: 7 },
    { cells: ['A4', 'B4'], operator: 'x', value: 12 },
    { cells: ['C1', 'C2'], operator: '+', value: 7 },
    { cells: ['D1', 'D2'], operator: '-', value: 1 },
    { cells: ['C3', 'D3'], operator: '+', value: 3 },
    { cells: ['C4', 'D4'], operator: 'x', value: 2 }
  ],
  hasOperators: true,
  meta: 'Size 4x4',
  puzzleSize: 4,
  title: 'Test Puzzle'
});

function createRendererWithInit(): SvgRenderer {
  const renderer = new SvgRenderer();
  renderer.initGrid(
    SIZE_4_PUZZLE_JSON.puzzleSize,
    SIZE_4_PUZZLE_JSON.cages,
    SIZE_4_PUZZLE_JSON.hasOperators ?? true,
    SIZE_4_PUZZLE_JSON.title ?? '',
    SIZE_4_PUZZLE_JSON.meta ?? ''
  );
  renderer.pushInitialSlide();
  return renderer;
}

describe('buildSolutionYaml', () => {
  it('produces valid YAML with puzzle and steps', () => {
    const renderer = createRendererWithInit();
    initPuzzleSlides({
      cages: SIZE_4_PUZZLE_JSON.cages,
      hasOperators: true,
      initialStrategies: createInitialStrategies(),
      puzzleSize: 4,
      renderer,
      strategies: createStrategies(4)
    });

    const manualNotes = renderer.slides.map((s) => s.notes);
    const yamlStr = buildSolutionYaml({
      hasOperators: true,
      manualNotes,
      puzzleJson: SIZE_4_PUZZLE_JSON,
      slides: renderer.slides
    });

    expect(yamlStr).toContain('puzzle:');
    expect(yamlStr).toContain('steps:');
    expect(yamlStr).toContain('size: 4');
  });

  it('all steps have command objects and note strings', () => {
    const renderer = createRendererWithInit();
    initPuzzleSlides({
      cages: SIZE_4_PUZZLE_JSON.cages,
      hasOperators: true,
      initialStrategies: createInitialStrategies(),
      puzzleSize: 4,
      renderer,
      strategies: createStrategies(4)
    });

    const manualNotes = renderer.slides.map((s) => s.notes);
    const yamlStr = buildSolutionYaml({
      hasOperators: true,
      manualNotes,
      puzzleJson: SIZE_4_PUZZLE_JSON,
      slides: renderer.slides
    });

    const parsed = parseSolutionYaml(yamlStr);
    for (const step of parsed.steps) {
      expect(step.command).toBeDefined();
      expect(typeof step.note).toBe('string');
    }
  });

  it('includes operator in cage when hasOperators is true', () => {
    const renderer = createRendererWithInit();
    initPuzzleSlides({
      cages: SIZE_4_PUZZLE_JSON.cages,
      hasOperators: true,
      initialStrategies: createInitialStrategies(),
      puzzleSize: 4,
      renderer,
      strategies: createStrategies(4)
    });

    const manualNotes = renderer.slides.map((s) => s.notes);
    const yamlStr = buildSolutionYaml({
      hasOperators: true,
      manualNotes,
      puzzleJson: SIZE_4_PUZZLE_JSON,
      slides: renderer.slides
    });

    const parsed = parseSolutionYaml(yamlStr);
    const plusCage = parsed.puzzle.cages.find((c) => c.value === 3 && c.cells.includes('A1'));
    expect(plusCage?.operator).toBe('+');
  });
});

describe('parseSolutionYaml', () => {
  it('validates and returns typed data', () => {
    const yamlStr = `puzzle:
  size: 4
  hasOperators: true
  cages:
    - cells: [A1, A2]
      value: 3
      operator: "+"
    - cells: [B1, B2]
      value: 1
      operator: "-"
    - cells: [A3, B3]
      value: 7
      operator: "+"
    - cells: [A4, B4]
      value: 12
      operator: x
    - cells: [C1, C2]
      value: 7
      operator: "+"
    - cells: [D1, D2]
      value: 1
      operator: "-"
    - cells: [C3, D3]
      value: 3
      operator: "+"
    - cells: [C4, D4]
      value: 2
      operator: x
steps:
  - command:
      A1-D4: 1234
    note: "Filling all candidates"
`;

    const data = parseSolutionYaml(yamlStr);
    expect(data.puzzle.size).toBe(4);
    expect(data.puzzle.hasOperators).toBe(true);
    expect(data.puzzle.cages).toHaveLength(8);
    expect(data.steps).toHaveLength(1);
    expect(data.steps[0]?.command).toEqual({ 'A1-D4': 1234 });
    expect(data.steps[0]?.note).toBe('Filling all candidates');
  });

  it('throws on invalid YAML', () => {
    expect(() => parseSolutionYaml('invalid: [[')).toThrow();
  });
});

describe('puzzleJsonFromSolution', () => {
  it('converts solution puzzle to PuzzleJson', () => {
    const yamlStr = `puzzle:
  size: 4
  hasOperators: true
  title: "Test Puzzle"
  meta: "Size 4x4"
  cages:
    - cells: [A1, A2]
      value: 3
      operator: "+"
    - cells: [B1, B2]
      value: 1
      operator: "-"
    - cells: [A3, B3]
      value: 7
      operator: "+"
    - cells: [A4, B4]
      value: 12
      operator: x
    - cells: [C1, C2]
      value: 7
      operator: "+"
    - cells: [D1, D2]
      value: 1
      operator: "-"
    - cells: [C3, D3]
      value: 3
      operator: "+"
    - cells: [C4, D4]
      value: 2
      operator: x
steps: []
`;

    const solution = parseSolutionYaml(yamlStr);
    const puzzleJson = puzzleJsonFromSolution(solution);
    expect(puzzleJson.puzzleSize).toBe(4);
    expect(puzzleJson.cages).toHaveLength(8);
    expect(puzzleJson.title).toBe('Test Puzzle');
  });
});

describe('buildCommand', () => {
  it('builds value command', () => {
    const puzzle = createTestPuzzle({
      cages: [
        { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
        { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
      ],
      hasOperators: true,
      puzzleSize: 2
    });
    const cell = puzzle.getCell('A1');
    const changes = [new ValueChange(cell, 1)];
    const command = buildCommand(changes);
    expect(command).toEqual({ A1: '=1' });
  });

  it('builds candidates command', () => {
    const puzzle = createTestPuzzle({
      cages: [
        { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
        { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
      ],
      hasOperators: true,
      puzzleSize: 2
    });
    const changes = [
      new CandidatesChange(puzzle.getCell('A1'), [1, 2]),
      new CandidatesChange(puzzle.getCell('B1'), [1, 2])
    ];
    const command = buildCommand(changes);
    // Both cells form a 1x2 rectangle → range selector
    expect(command).toEqual({ 'A1-B1': 12 });
  });

  it('builds strikethrough command', () => {
    const puzzle = createTestPuzzle({
      cages: [
        { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
        { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
      ],
      hasOperators: true,
      puzzleSize: 2
    });
    const changes = [new CandidatesStrikethrough(puzzle.getCell('A1'), [2])];
    const command = buildCommand(changes);
    expect(command).toEqual({ A1: -2 });
  });

  it('filters derived peer strikethroughs from value changes', () => {
    const puzzle = createTestPuzzle({
      cages: [
        { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
        { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
      ],
      hasOperators: true,
      puzzleSize: 2
    });
    const cell = puzzle.getCell('A1');
    const changes = [
      new ValueChange(cell, 1),
      // Peer strikethroughs for value 1
      new CandidatesStrikethrough(puzzle.getCell('B1'), [1]),
      new CandidatesStrikethrough(puzzle.getCell('A2'), [1])
    ];
    const command = buildCommand(changes);
    // Only the value command, no strikethroughs (they're derived)
    expect(command).toEqual({ A1: '=1' });
  });

  it('groups rectangle cells using range selector', () => {
    const puzzle = createTestPuzzle({
      cages: [
        { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
        { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
      ],
      hasOperators: true,
      puzzleSize: 2
    });
    const changes = [
      new CandidatesChange(puzzle.getCell('A1'), [1, 2]),
      new CandidatesChange(puzzle.getCell('B1'), [1, 2]),
      new CandidatesChange(puzzle.getCell('A2'), [1, 2]),
      new CandidatesChange(puzzle.getCell('B2'), [1, 2])
    ];
    const command = buildCommand(changes);
    expect(command).toEqual({ 'A1-B2': 12 });
  });
});

describe('resolveCommand', () => {
  const SIZE_2_CAGES = [
    { cells: ['A1', 'B1'], operator: Operator.Plus, value: 3 },
    { cells: ['A2', 'B2'], operator: Operator.Plus, value: 3 }
  ];

  it('resolves value command with peer strikethroughs', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2 });
    for (const cell of puzzle.cells) {
      cell.setCandidates([1, 2]);
    }

    const changes = resolveCommand(puzzle, { A1: '=1' });
    const valueChanges = changes.filter((c) => c instanceof ValueChange);
    const strikethroughs = changes.filter((c) => c instanceof CandidatesStrikethrough);

    expect(valueChanges).toHaveLength(1);
    expect(strikethroughs.length).toBeGreaterThan(0);
  });

  it('resolves candidates command', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2 });

    const changes = resolveCommand(puzzle, { A1: 12 });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toBeInstanceOf(CandidatesChange);
    expect((changes[0] as CandidatesChange).values).toEqual([1, 2]);
  });

  it('resolves strikethrough command', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2 });
    puzzle.getCell('A1').setCandidates([1, 2]);

    const changes = resolveCommand(puzzle, { A1: -2 });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toBeInstanceOf(CandidatesStrikethrough);
    expect((changes[0] as CandidatesStrikethrough).values).toEqual([2]);
  });

  it('resolves range selector', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2 });

    const changes = resolveCommand(puzzle, { 'A1-B2': 12 });
    expect(changes).toHaveLength(4);
    for (const change of changes) {
      expect(change).toBeInstanceOf(CandidatesChange);
    }
  });

  it('resolves cage selector', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2 });

    const changes = resolveCommand(puzzle, { '@A1': 12 });
    expect(changes).toHaveLength(2);
    const refs = changes.map((c) => (c as CandidatesChange).cell.ref);
    expect(refs).toContain('A1');
    expect(refs).toContain('B1');
  });

  it('resolves explicit group selector', () => {
    const puzzle = createTestPuzzle({ cages: SIZE_2_CAGES, hasOperators: true, puzzleSize: 2 });

    const changes = resolveCommand(puzzle, { '(A1 B2)': 12 });
    expect(changes).toHaveLength(2);
    const refs = changes.map((c) => (c as CandidatesChange).cell.ref);
    expect(refs).toContain('A1');
    expect(refs).toContain('B2');
  });
});

describe('round-trip', () => {
  it('build -> parse -> replay -> build produces stable output', () => {
    const renderer = createRendererWithInit();
    initPuzzleSlides({
      cages: SIZE_4_PUZZLE_JSON.cages,
      hasOperators: true,
      initialStrategies: createInitialStrategies(),
      puzzleSize: 4,
      renderer,
      strategies: createStrategies(4)
    });

    const manualNotes = renderer.slides.map((s) => s.notes);
    const yaml1 = buildSolutionYaml({
      hasOperators: true,
      manualNotes,
      puzzleJson: SIZE_4_PUZZLE_JSON,
      slides: renderer.slides
    });

    const parsed = parseSolutionYaml(yaml1);
    const puzzleJson2 = puzzleJsonFromSolution(parsed);

    const renderer2 = new SvgRenderer();
    renderer2.initGrid(
      puzzleJson2.puzzleSize,
      puzzleJson2.cages,
      puzzleJson2.hasOperators ?? true,
      puzzleJson2.title ?? '',
      puzzleJson2.meta ?? ''
    );
    renderer2.pushInitialSlide();

    const result = replaySolution({
      puzzleJson: puzzleJson2,
      renderer: renderer2,
      steps: parsed.steps
    });

    const yaml2 = buildSolutionYaml({
      hasOperators: puzzleJson2.hasOperators !== false,
      manualNotes: result.manualNotes,
      puzzleJson: puzzleJson2,
      slides: renderer2.slides
    });

    // Both should produce the same steps (same command sequence)
    const parsed1 = parseSolutionYaml(yaml1);
    const parsed2 = parseSolutionYaml(yaml2);
    expect(parsed2.steps.length).toBe(parsed1.steps.length);

    for (let i = 0; i < parsed1.steps.length; i++) {
      expect(parsed2.steps[i]?.command).toEqual(parsed1.steps[i]?.command);
      expect(parsed2.steps[i]?.note).toBe(parsed1.steps[i]?.note);
    }
  });
});
