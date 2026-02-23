import type { CellChange } from './cellChanges/CellChange.ts';
import type { CellOperation } from './parsers.ts';
import type { Strategy } from './strategies/Strategy.ts';

import { CandidatesChange } from './cellChanges/CandidatesChange.ts';
import { CandidatesStrikethrough } from './cellChanges/CandidatesStrikethrough.ts';
import { CellClearance } from './cellChanges/CellClearance.ts';
import { ValueChange } from './cellChanges/ValueChange.ts';
import { evaluateTuple } from './combinatorics.ts';
import {
  getCellRef,
  parseOperation
} from './parsers.ts';
import { buildNote } from './strategies/Strategy.ts';
import { ensureNonNullable } from './typeGuards.ts';

export enum Operator {
  Divide = '/',
  Minus = '-',
  Plus = '+',
  Times = 'x',
  Unknown = '?'
}

export interface CageRaw {
  readonly cells: readonly string[];
  readonly operator: Operator;
  readonly value: number;
}

export interface CellValueSetter {
  readonly cell: Cell;
  readonly value: number;
}

export type HouseType = 'column' | 'row';

export interface InitPuzzleSlidesOptions {
  readonly cages: readonly CageRaw[];
  readonly hasOperators: boolean;
  readonly initialStrategies: readonly Strategy[];
  readonly meta?: string;
  readonly puzzleSize: number;
  readonly renderer: PuzzleRenderer;
  readonly strategies: readonly Strategy[];
  readonly title?: string;
}

export interface PuzzleJson {
  readonly cages: readonly CageRaw[];
  readonly hasOperators?: boolean;
  readonly meta?: string;
  readonly puzzleSize: number;
  readonly title?: string;
}

export interface PuzzleOptions {
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
  renderPendingClearance(change: CellClearance): void;
  renderPendingStrikethrough(change: CandidatesStrikethrough): void;
  renderPendingValue(change: ValueChange): void;
  setNoteText(text: string): void;
}

export interface PuzzleState {
  readonly cages: readonly CageRaw[];
  readonly hasOperators: boolean;
  readonly puzzleSize: number;
}
interface EnterCommand {
  readonly cells: readonly Cell[];
  readonly operation: CellOperation;
}

const CHAR_CODE_A = 65;

export class Cage {
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
    const opStr = this.operator === Operator.Unknown ? String(this.value) : `${String(this.value)}${this.operator}`;
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
    this.label = type === 'row' ? String(id) : String.fromCharCode(CHAR_CODE_A + id - 1);
  }

  public getCell(id: number): Cell {
    return ensureNonNullable(this.cells[id - 1]);
  }

  public toString(): string {
    return `${this.type === 'row' ? 'Row' : 'Column'} ${this.label}`;
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
  private pendingChanges: readonly CellChange[] = [];
  private readonly renderer: PuzzleRenderer;
  private readonly strategies: readonly Strategy[];

  public constructor(options: PuzzleOptions) {
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
      rows.push(new House('row', houseId, ensureNonNullable(grid[houseId - 1])));
      columns.push(new House('column', houseId, grid.map((gridRow) => ensureNonNullable(gridRow[houseId - 1]))));
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
    this.pendingChanges = changes;
    this.renderer.beginPendingRender(this.puzzleSize);
    for (const change of changes) {
      change.renderPending(this.renderer);
    }
  }

  public commit(): void {
    for (const change of this.pendingChanges) {
      change.applyToModel();
    }
    this.renderer.renderCommittedChanges(this.puzzleSize);
    this.pendingChanges = [];
  }

  public enter(input: string): void {
    if (!this.renderer.ensureLastSlide()) {
      return;
    }
    this.renderer.setNoteText(input);
    const commentIndex = input.indexOf('//');
    const commandPart = commentIndex >= 0 ? input.substring(0, commentIndex) : input;
    const changes = this.buildEnterChanges(commandPart);
    this.applyChanges(changes);
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
          this.renderer.setNoteText(buildNote(strategy.name, result.details));
          this.applyChanges(result.changeGroups.flatMap((g) => g.changes));
          this.commit();
          applied = true;
          canApply = true;
          break;
        }
      }
    }
    return applied;
  }

  private buildEnterChanges(input: string): CellChange[] {
    const commands = this.parseInput(input);
    for (const cmd of commands) {
      this.validateEnterCommand(cmd);
    }
    const changes: CellChange[] = [];
    for (const cmd of commands) {
      for (const cell of cmd.cells) {
        switch (cmd.operation.type) {
          case 'candidates':
            changes.push(new CandidatesChange(cell, cmd.operation.values));
            break;
          case 'clear':
            changes.push(new CellClearance(cell));
            break;
          case 'strikethrough':
            changes.push(new CandidatesStrikethrough(cell, cmd.operation.values));
            break;
          case 'value':
            changes.push(new ValueChange(cell, cmd.operation.value));
            break;
          default: {
            const exhaustive: never = cmd.operation;
            throw new Error(`Unknown operation type: ${String(exhaustive)}`);
          }
        }
      }
      if (cmd.operation.type === 'value') {
        const cell = ensureNonNullable(cmd.cells[0]);
        for (const peer of cell.row.cells) {
          if (peer !== cell) {
            changes.push(new CandidatesStrikethrough(peer, [cmd.operation.value]));
          }
        }
        for (const peer of cell.column.cells) {
          if (peer !== cell) {
            changes.push(new CandidatesStrikethrough(peer, [cmd.operation.value]));
          }
        }
      } else if (cmd.operation.type === 'candidates') {
        for (const cell of cmd.cells) {
          const conflicting = cell.peerValues;
          if (conflicting.length > 0) {
            changes.push(new CandidatesStrikethrough(cell, [...conflicting]));
          }
        }
      }
    }
    return changes;
  }

  private parseCageExclusion(anchorRef: string, exclusionPart: string): Cell[] {
    const anchor = this.getCell(anchorRef);
    const cageCells = [...anchor.cage.cells];
    const trimmed = exclusionPart.trim();
    const exclusionRefs = trimmed.startsWith('(') && trimmed.endsWith(')')
      ? trimmed.substring(1, trimmed.length - 1).trim().split(/\s+/)
      : [trimmed];
    const excludedCells = new Set(exclusionRefs.map((ref) => this.getCell(ref)));
    return cageCells.filter((cell) => !excludedCells.has(cell));
  }

  private parseCellPart(cellPart: string): Cell[] {
    let inner = cellPart;
    if (inner.startsWith('(') && inner.endsWith(')')) {
      inner = inner.substring(1, inner.length - 1);
    }
    const trimmed = inner.trim();

    const rowMatch = /^Row\s+(?<id>\d+)$/i.exec(trimmed);
    if (rowMatch) {
      return [...this.getRow(parseInt(ensureNonNullable(ensureNonNullable(rowMatch.groups)['id']), 10)).cells];
    }

    const columnMatch = /^Column\s+(?<col>[A-Za-z])$/i.exec(trimmed);
    if (columnMatch) {
      const colId = ensureNonNullable(ensureNonNullable(columnMatch.groups)['col']).toUpperCase().charCodeAt(0) - CHAR_CODE_A + 1;
      return [...this.getColumn(colId).cells];
    }

    const rangeMatch = /^(?<start>[A-Za-z]\d+)\.\.(?<end>[A-Za-z]\d+)$/.exec(trimmed);
    if (rangeMatch) {
      const groups = ensureNonNullable(rangeMatch.groups);
      return this.parseCellRange(ensureNonNullable(groups['start']), ensureNonNullable(groups['end']));
    }

    const cageExclMatch = /^@(?<anchor>[A-Za-z]\d+)-(?<exclusion>.+)$/.exec(trimmed);
    if (cageExclMatch) {
      const groups = ensureNonNullable(cageExclMatch.groups);
      return this.parseCageExclusion(ensureNonNullable(groups['anchor']), ensureNonNullable(groups['exclusion']));
    }

    const cells: Cell[] = [];
    for (const token of trimmed.split(/\s+/)) {
      if (token.startsWith('@')) {
        const anchor = this.getCell(token.substring(1));
        for (const cell of anchor.cage.cells) {
          cells.push(cell);
        }
      } else {
        cells.push(this.getCell(token));
      }
    }
    return cells;
  }

  private parseCellRange(startRef: string, endRef: string): Cell[] {
    const start = parseCellRef(startRef);
    const end = parseCellRef(endRef);
    const minRow = Math.min(start.rowId, end.rowId);
    const maxRow = Math.max(start.rowId, end.rowId);
    const minCol = Math.min(start.columnId, end.columnId);
    const maxCol = Math.max(start.columnId, end.columnId);
    const cells: Cell[] = [];
    for (let rowId = minRow; rowId <= maxRow; rowId++) {
      for (let columnId = minCol; columnId <= maxCol; columnId++) {
        cells.push(this.getCell(rowId, columnId));
      }
    }
    return cells;
  }

  private parseInput(input: string): EnterCommand[] {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error('No commands specified');
    }
    const pattern = /(?:\([^)]*(?:\([^)]*\)[^)]*)*\)|@[A-Za-z]\d+|[A-Za-z]\d+):[^\s]+/g;
    const matches = trimmed.match(pattern);
    if (!matches || matches.length === 0) {
      throw new Error('Invalid format. Expected: A1:=1, (Row 3):-12, (Column A):34, (A1..D4):-3, (@D4-A1):234');
    }
    const commands: EnterCommand[] = [];
    for (const match of matches) {
      const colonIdx = match.startsWith('(')
        ? match.indexOf(':', match.indexOf(')'))
        : match.indexOf(':');
      const cellPart = match.substring(0, colonIdx);
      const opPart = match.substring(colonIdx + 1);
      const cells = this.parseCellPart(cellPart);
      const operation = parseOperation(opPart, cells.length);
      commands.push({ cells, operation });
    }
    return commands;
  }

  private validateCageAfterValue(cell: Cell, value: number): void {
    const cage = cell.cage;
    // Only validate when all cells in the cage would be solved
    const allSolved = cage.cells.every((c) => c === cell ? true : c.isSolved);
    if (!allSolved) {
      return;
    }
    const tuple = cage.cells.map((c) => c === cell ? value : ensureNonNullable(c.value));
    if (this.hasOperators && cage.operator !== Operator.Unknown) {
      if (evaluateTuple(tuple, cage.operator) !== cage.value) {
        throw new Error(`${cell.ref} = ${String(value)} makes cage @${cage.topLeft.ref} invalid`);
      }
    } else {
      const validForAny = [Operator.Divide, Operator.Minus, Operator.Plus, Operator.Times].some((op) => evaluateTuple(tuple, op) === cage.value);
      if (!validForAny) {
        throw new Error(`${cell.ref} = ${String(value)} makes cage @${cage.topLeft.ref} invalid`);
      }
    }
  }

  private validateEnterCommand(cmd: EnterCommand): void {
    if (cmd.operation.type === 'value') {
      const value = cmd.operation.value;
      if (value > this.puzzleSize) {
        throw new Error(`Value ${String(value)} exceeds puzzle size ${String(this.puzzleSize)}`);
      }
      const cell = ensureNonNullable(cmd.cells[0]);
      for (const peer of cell.peers) {
        if (peer.value === value) {
          throw new Error(`${cell.ref} = ${String(value)} conflicts with ${peer.ref} which is already ${String(value)}`);
        }
      }
      this.validateCageAfterValue(cell, value);
      return;
    }

    if (cmd.operation.type === 'candidates' || cmd.operation.type === 'strikethrough') {
      for (const v of cmd.operation.values) {
        if (v > this.puzzleSize) {
          throw new Error(`Value ${String(v)} exceeds puzzle size ${String(this.puzzleSize)}`);
        }
      }
    }
  }
}

export function initPuzzleSlides(options: InitPuzzleSlidesOptions): Puzzle {
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
      options.renderer.setNoteText(buildNote(strategy.name, result.details));
      puzzle.applyChanges(result.changeGroups.flatMap((g) => g.changes));
      puzzle.commit();
    }
  }
  puzzle.tryApplyAutomatedStrategies();
  return puzzle;
}

export function parsePuzzleJson(data: unknown): PuzzleJson {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Puzzle data must be an object');
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj['puzzleSize'] !== 'number') {
    throw new Error('puzzleSize must be a number');
  }
  if (!Array.isArray(obj['cages'])) {
    throw new Error('cages must be an array');
  }
  const cages = (obj['cages'] as unknown[]).map((raw, i) => validateCageRaw(raw, i));
  return {
    cages,
    puzzleSize: obj['puzzleSize'],
    ...(typeof obj['hasOperators'] === 'boolean' && { hasOperators: obj['hasOperators'] }),
    ...(typeof obj['meta'] === 'string' && { meta: obj['meta'] }),
    ...(typeof obj['title'] === 'string' && { title: obj['title'] })
  };
}

export function parsePuzzleState(data: unknown): PuzzleState {
  const json = parsePuzzleJson(data);
  const obj = data as Record<string, unknown>;
  if (typeof obj['hasOperators'] !== 'boolean') {
    throw new Error('hasOperators must be a boolean');
  }
  return {
    cages: json.cages,
    hasOperators: obj['hasOperators'],
    puzzleSize: json.puzzleSize
  };
}

const VALID_OPERATORS = new Set<string>([Operator.Divide, Operator.Minus, Operator.Plus, Operator.Times, Operator.Unknown]);

function validateCageRaw(data: unknown, index: number): CageRaw {
  if (typeof data !== 'object' || data === null) {
    throw new Error(`cages[${String(index)}] must be an object`);
  }
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj['cells']) || obj['cells'].length === 0) {
    throw new Error(`cages[${String(index)}].cells must be a non-empty array`);
  }
  if (typeof obj['value'] !== 'number') {
    throw new Error(`cages[${String(index)}].value must be a number`);
  }
  const rawOp = obj['operator'];
  let operator: Operator;
  if (rawOp === undefined) {
    operator = Operator.Unknown;
  } else if (typeof rawOp === 'string' && VALID_OPERATORS.has(rawOp)) {
    operator = rawOp as Operator;
  } else {
    throw new Error(`cages[${String(index)}].operator must be one of +, -, x, /`);
  }
  return {
    cells: obj['cells'] as string[],
    operator,
    value: obj['value']
  };
}

// Re-export parseCellRef for use outside
import { parseCellRef } from './parsers.ts';
