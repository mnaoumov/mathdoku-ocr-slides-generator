import { z } from 'zod';

import type { CellChange } from './cellChanges/CellChange.ts';
import type { Strategy } from './strategies/Strategy.ts';

import { CandidatesChange } from './cellChanges/CandidatesChange.ts';
import { CandidatesStrikethrough } from './cellChanges/CandidatesStrikethrough.ts';
import { ValueChange } from './cellChanges/ValueChange.ts';
import {
  getCellRef,
  parseCellRef
} from './parsers.ts';
import {
  buildCommand,
  type SolutionCommand
} from './solutionCommand.ts';
import { buildNote } from './strategies/Strategy.ts';
import { ensureNonNullable } from './typeGuards.ts';

export enum Operator {
  Divide = '/',
  Exact = '=',
  Minus = '-',
  Plus = '+',
  Times = 'x',
  Unknown = '?'
}

const operatorSchema = z.enum(Operator).default(Operator.Unknown);

const cageRawSchema = z.object({
  cells: z.array(z.string()).nonempty(),
  operator: operatorSchema,
  value: z.number()
}).readonly().transform((cage) =>
  cage.cells.length === SINGLE_CELL_COUNT
    ? { ...cage, operator: Operator.Exact }
    : cage
);

const puzzleJsonSchema = z.object({
  cages: z.array(cageRawSchema),
  hasOperators: z.boolean().optional(),
  meta: z.string().optional(),
  puzzleSize: z.number(),
  title: z.string().optional()
}).readonly();

const puzzleStateSchema = z.object({
  cages: z.array(cageRawSchema),
  hasOperators: z.boolean(),
  meta: z.string().optional(),
  puzzleSize: z.number(),
  title: z.string().optional()
}).readonly();

export enum HouseType {
  Column = 'column',
  Row = 'row'
}

export type CageRaw = z.infer<typeof cageRawSchema>;

export interface CellSnapshot {
  getCandidates(): number[];
  readonly ref: string;
  readonly value: null | number;
}

export interface CellValueSetter {
  readonly cell: Cell;
  readonly value: number;
}

export interface InitPuzzleSlidesParams {
  readonly cages: readonly CageRaw[];
  readonly hasOperators: boolean;
  readonly initialStrategies: readonly Strategy[];
  readonly meta?: string;
  readonly puzzleSize: number;
  readonly renderer: PuzzleRenderer;
  readonly strategies: readonly Strategy[];
  readonly title?: string;
}

export type PuzzleJson = z.infer<typeof puzzleJsonSchema>;

export interface PuzzleParams {
  readonly cages: readonly CageRaw[];
  readonly hasOperators: boolean;
  readonly initialCandidates?: Map<string, Set<number>>;
  readonly initialValues?: Map<string, number>;
  readonly meta?: string;
  readonly puzzleSize: number;
  readonly renderer: PuzzleRenderer;
  readonly strategies: readonly Strategy[];
  readonly title?: string;
}

export interface PuzzleRenderer {
  beginPendingRender(puzzleSize: number): void;
  ensureLastSlide(): boolean;
  renderCommittedChanges(puzzleSize: number): void;
  renderPendingCandidates(change: CandidatesChange): void;
  renderPendingStrikethrough(change: CandidatesStrikethrough): void;
  renderPendingValue(change: ValueChange): void;
  restoreCellStates(cells: readonly CellSnapshot[]): void;
  setCommand(command: SolutionCommand): void;
  setNoteText(text: string): void;
  readonly slideCount: number;
  readonly slides: readonly { readonly command: SolutionCommand; readonly notes: string }[];
}

export type PuzzleState = z.infer<typeof puzzleStateSchema>;

export interface StepResult {
  readonly applied: boolean;
  readonly message?: string;
  readonly skipped: readonly string[];
  readonly slideNumber: number;
}

const CHAR_CODE_A = 65;
const SINGLE_CELL_COUNT = 1;

export class Cage {
  public deducedOperator?: Operator;
  public readonly operator: Operator;
  public readonly value: number;

  public get topLeft(): Cell {
    return ensureNonNullable(this.cells[0]);
  }

  public constructor(
    public readonly id: number,
    public readonly cells: readonly Cell[],
    operator: Operator,
    value: number
  ) {
    this.operator = operator;
    this.value = value;
  }

  public contains(cell: Cell): boolean {
    return this.cells.includes(cell);
  }

  public toString(): string {
    const opStr = this.operator === Operator.Exact || this.operator === Operator.Unknown
      ? String(this.value)
      : `${String(this.value)}${this.operator}`;
    const cellRefs = this.cells.map(String).join(',');
    return `Cage(${opStr} ${cellRefs})`;
  }
}

export class Cell {
  public readonly ref: string;
  public get cage(): Cage {
    return this.puzzle.getCage(this.cageId);
  }

  public get candidateCount(): number {
    return this._candidates.size;
  }

  public get column(): House {
    return this.puzzle.getColumn(this.columnId);
  }

  public get isSolved(): boolean {
    return this._value !== null;
  }

  public get peers(): readonly Cell[] {
    if (!this._peers) {
      const result: Cell[] = [];
      for (const cell of this.row.cells) {
        if (cell !== this) {
          result.push(cell);
        }
      }
      for (const cell of this.column.cells) {
        if (cell !== this) {
          result.push(cell);
        }
      }
      this._peers = result;
    }
    return this._peers;
  }

  public get peerValues(): readonly number[] {
    const result: number[] = [];
    for (const peer of this.peers) {
      if (peer.value !== null) {
        result.push(peer.value);
      }
    }
    return result;
  }

  public get row(): House {
    return this.puzzle.getRow(this.rowId);
  }

  public get value(): null | number {
    return this._value;
  }

  private readonly _candidates = new Set<number>();
  private _peers: null | readonly Cell[] = null;

  private _value: null | number = null;

  public constructor(
    private readonly puzzle: Puzzle,
    private readonly rowId: number,
    private readonly columnId: number,
    private readonly cageId: number
  ) {
    this.ref = getCellRef(rowId, columnId);
  }

  public static compare(a: Cell, b: Cell): number {
    return a.rowId - b.rowId || a.columnId - b.columnId;
  }

  public addCandidate(value: number): void {
    this._candidates.add(value);
  }

  public clearCandidates(): void {
    this._candidates.clear();
  }

  public clearValue(): void {
    this._value = null;
  }

  public getCandidates(): number[] {
    return [...this._candidates].sort((a, b) => a - b);
  }

  public hasCandidate(value: number): boolean {
    return this._candidates.has(value);
  }

  public removeCandidate(value: number): void {
    this._candidates.delete(value);
  }

  public setCandidates(values: Iterable<number>): void {
    this._candidates.clear();
    for (const v of values) {
      this._candidates.add(v);
    }
  }

  public setValue(value: number): void {
    this._value = value;
  }

  public toString(): string {
    return this.ref;
  }
}

export class House {
  public readonly label: string;

  public constructor(public readonly type: HouseType, public readonly id: number, public readonly cells: readonly Cell[]) {
    this.label = type === HouseType.Row ? String(id) : String.fromCharCode(CHAR_CODE_A + id - 1);
  }

  public getCell(id: number): Cell {
    return ensureNonNullable(this.cells[id - 1]);
  }

  public toString(): string {
    return `${this.type === HouseType.Row ? 'Row' : 'Column'} ${this.label}`;
  }
}

export class Puzzle {
  public readonly cages: readonly Cage[];
  public readonly cells: readonly Cell[];
  public readonly columns: readonly House[];
  public readonly hasOperators: boolean;
  public readonly houses: readonly House[];
  public readonly meta: string;

  public readonly puzzleSize: number;
  public readonly rows: readonly House[];
  public readonly title: string;
  private candidatesInitialized = false;
  private pendingChanges: readonly CellChange[] = [];
  private readonly renderer: PuzzleRenderer;
  private readonly strategies: readonly Strategy[];

  public constructor(options: PuzzleParams) {
    const { cages: cagesRaw, hasOperators, initialCandidates, initialValues, meta = '', puzzleSize, renderer, strategies, title = '' } = options;
    this.hasOperators = hasOperators;
    this.meta = meta;
    this.puzzleSize = puzzleSize;
    this.renderer = renderer;
    this.strategies = strategies;
    this.title = title;

    const cellToCageId: Record<string, number> = {};
    for (let cageId = 1; cageId <= cagesRaw.length; cageId++) {
      const cage = ensureNonNullable(cagesRaw[cageId - 1]);
      for (const cellRef of cage.cells) {
        cellToCageId[cellRef] = cageId;
      }
    }

    const grid: Cell[][] = [];
    for (let rowId = 1; rowId <= puzzleSize; rowId++) {
      const row: Cell[] = [];
      for (let columnId = 1; columnId <= puzzleSize; columnId++) {
        const ref = getCellRef(rowId, columnId);
        const cageId = cellToCageId[ref];
        if (cageId === undefined) {
          throw new Error(`Cell ${ref} not found in any cage`);
        }
        row.push(new Cell(this, rowId, columnId, cageId));
      }
      grid.push(row);
    }

    const rows: House[] = [];
    const columns: House[] = [];
    for (let houseId = 1; houseId <= puzzleSize; houseId++) {
      rows.push(new House(HouseType.Row, houseId, ensureNonNullable(grid[houseId - 1])));
      columns.push(new House(HouseType.Column, houseId, grid.map((gridRow) => ensureNonNullable(gridRow[houseId - 1]))));
    }
    this.rows = rows;
    this.columns = columns;
    this.houses = [...rows, ...columns];

    const cages: Cage[] = [];
    for (let cageId = 1; cageId <= cagesRaw.length; cageId++) {
      const raw = ensureNonNullable(cagesRaw[cageId - 1]);
      const cageCells = raw.cells.map((ref) => {
        const parsed = parseCellRef(ref);
        return ensureNonNullable(ensureNonNullable(grid[parsed.rowId - 1])[parsed.columnId - 1]);
      });
      cageCells.sort((a, b) => a.row.id - b.row.id || a.column.id - b.column.id);
      if (cageCells.length === SINGLE_CELL_COUNT && raw.operator !== Operator.Exact) {
        const cellRef = ensureNonNullable(cageCells[0]).ref;
        throw new Error(`Single-cell cage ${cellRef} must use Operator.Exact, got '${raw.operator}'`);
      }
      cages.push(new Cage(cageId, cageCells, raw.operator, raw.value));
    }
    this.cages = cages;

    this.cells = rows.flatMap((row) => [...row.cells]);

    if (initialValues) {
      for (const [ref, cellValue] of initialValues) {
        this.getCell(ref).setValue(cellValue);
      }
    }
    if (initialCandidates) {
      for (const [ref, cands] of initialCandidates) {
        this.getCell(ref).setCandidates(cands);
      }
    }
  }

  public applyChanges(changes: readonly CellChange[]): void {
    const augmented = this.augmentCandidateChanges(changes);
    this.pendingChanges = augmented;
    this.renderer.beginPendingRender(this.puzzleSize);
    for (const change of augmented) {
      change.renderPending(this.renderer);
    }
  }

  public commit(): void {
    for (const change of this.pendingChanges) {
      change.applyToModel();
    }
    this.renderer.renderCommittedChanges(this.puzzleSize);
    this.pendingChanges = [];
    if (!this.candidatesInitialized) {
      this.candidatesInitialized = this.cells.every((c) => c.isSolved || c.candidateCount > 0);
    }
    if (this.candidatesInitialized) {
      this.validatePostCommit();
    }
  }

  public getCage(id: number): Cage {
    return ensureNonNullable(this.cages[id - 1]);
  }

  public getCell(ref: string): Cell;
  public getCell(rowId: number, columnId: number): Cell;
  public getCell(refOrRowId: number | string, columnId?: number): Cell {
    if (typeof refOrRowId === 'string') {
      const parsed = parseCellRef(refOrRowId);
      return this.getRow(parsed.rowId).getCell(parsed.columnId);
    }
    return this.getRow(refOrRowId).getCell(ensureNonNullable(columnId));
  }

  public getColumn(id: number): House {
    return ensureNonNullable(this.columns[id - 1]);
  }

  public getRow(id: number): House {
    return ensureNonNullable(this.rows[id - 1]);
  }

  public tryApplyAutomatedStrategies(): boolean {
    if (!this.renderer.ensureLastSlide()) {
      return false;
    }
    let applied = false;
    let canApply = true;
    while (canApply) {
      canApply = false;
      for (const strategy of this.strategies) {
        const result = strategy.tryApply(this);
        if (result) {
          const changes = result.changeGroups.flatMap((g) => g.changes);
          this.renderer.setNoteText(buildNote(strategy.name, result.details));
          this.renderer.setCommand(buildCommand(changes));
          this.applyChanges(changes);
          this.commit();
          applied = true;
          canApply = true;
          break;
        }
      }
    }
    return applied;
  }

  public tryApplyOneStrategyStep(strategies: readonly Strategy[]): StepResult {
    const skipped: string[] = [];
    for (const strategy of strategies) {
      const result = strategy.tryApply(this);
      if (result) {
        const changes = result.changeGroups.flatMap((g) => g.changes);
        const message = buildNote(strategy.name, result.details);
        this.renderer.setNoteText(message);
        this.renderer.setCommand(buildCommand(changes));
        this.applyChanges(changes);
        this.commit();
        return { applied: true, message, skipped, slideNumber: this.renderer.slideCount };
      }
      skipped.push(strategy.name);
    }
    return { applied: false, skipped, slideNumber: this.renderer.slideCount };
  }

  private augmentCandidateChanges(changes: readonly CellChange[]): readonly CellChange[] {
    const augmented: CellChange[] = [];
    for (const change of changes) {
      if (change instanceof CandidatesChange) {
        const toStrikethrough: number[] = [];
        const peerValueSet = new Set(change.cell.peerValues);
        const droppedCandidates: number[] = [];
        if (change.cell.candidateCount > 0) {
          for (const v of change.cell.getCandidates()) {
            if (!change.values.includes(v)) {
              droppedCandidates.push(v);
            }
          }
        }
        if (droppedCandidates.length > 0) {
          const expandedValues = [...change.values, ...droppedCandidates].sort((a, b) => a - b);
          augmented.push(new CandidatesChange(change.cell, expandedValues));
        } else {
          augmented.push(change);
        }
        for (const v of change.values) {
          if (peerValueSet.has(v) || (change.cell.candidateCount > 0 && !change.cell.hasCandidate(v))) {
            toStrikethrough.push(v);
          }
        }
        for (const v of droppedCandidates) {
          toStrikethrough.push(v);
        }
        if (toStrikethrough.length > 0) {
          augmented.push(new CandidatesStrikethrough(change.cell, toStrikethrough));
        }
      } else {
        augmented.push(change);
      }
    }
    return augmented;
  }

  private validatePostCommit(): void {
    for (const house of this.houses) {
      const seen = new Map<number, Cell>();
      for (const cell of house.cells) {
        if (cell.value !== null) {
          const existing = seen.get(cell.value);
          if (existing) {
            throw new Error(
              `Latin square violation: ${existing.ref} and ${cell.ref} both have value ${String(cell.value)} in ${house.type} ${house.label}`
            );
          }
          seen.set(cell.value, cell);
        }
      }
    }

    let hasAnyCandidates = false;
    const emptyCells: Cell[] = [];
    for (const cell of this.cells) {
      if (cell.isSolved) {
        continue;
      }
      if (cell.candidateCount > 0) {
        hasAnyCandidates = true;
      } else {
        emptyCells.push(cell);
      }
    }
    if (hasAnyCandidates && emptyCells.length > 0) {
      const refs = emptyCells.map((c) => c.ref).join(', ');
      throw new Error(`Empty candidates on unsolved cells: ${refs}`);
    }
  }
}

export function initPuzzleSlides(options: InitPuzzleSlidesParams): Puzzle {
  const puzzle = new Puzzle({
    cages: options.cages,
    hasOperators: options.hasOperators,
    meta: options.meta ?? '',
    puzzleSize: options.puzzleSize,
    renderer: options.renderer,
    strategies: options.strategies,
    title: options.title ?? ''
  });
  for (const strategy of options.initialStrategies) {
    const result = strategy.tryApply(puzzle);
    if (result) {
      const changes = result.changeGroups.flatMap((g) => g.changes);
      options.renderer.setNoteText(buildNote(strategy.name, result.details));
      options.renderer.setCommand(buildCommand(changes));
      puzzle.applyChanges(changes);
      puzzle.commit();
    }
  }
  puzzle.tryApplyAutomatedStrategies();
  return puzzle;
}

export function parsePuzzleJson(data: unknown): PuzzleJson {
  return puzzleJsonSchema.parse(data);
}

export function parsePuzzleState(data: unknown): PuzzleState {
  return puzzleStateSchema.parse(data);
}
