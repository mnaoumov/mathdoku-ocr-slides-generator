import type {
  Cage,
  Cell,
  Puzzle
} from '../Puzzle.ts';
import type {
  ChangeGroup,
  Strategy,
  StrategyResult
} from './Strategy.ts';

import { CandidatesStrikethrough } from '../cellChanges/CandidatesStrikethrough.ts';
import { Operator } from '../Puzzle.ts';
import { ensureNonNullable } from '../typeGuards.ts';
import { getEffectiveOperator } from './cageOperationBounds.ts';

export interface CageContext {
  readonly cage: Cage;
  readonly cageValue: number;
  readonly cell: Cell;
  readonly cellCount: number;
  readonly otherCells: readonly Cell[];
  readonly puzzleSize: number;
  readonly solvedProduct: number;
  readonly solvedSum: number;
}

export interface CellElimination {
  readonly cell: Cell;
  readonly values: readonly number[];
}

interface CageGroupResult {
  readonly eliminations: readonly CellElimination[];
  readonly group: ChangeGroup;
}

export abstract class CageOperationStrategy implements Strategy {
  public abstract readonly name: string;

  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const allGroups: ChangeGroup[] = [];
    const allNoteEntries: string[] = [];

    for (const cage of puzzle.cages) {
      if (cage.cells.length <= 1) {
        continue;
      }

      const effectiveOperator = getEffectiveOperator(cage, puzzle.puzzleSize);

      if (!this.handlesOperator(effectiveOperator)) {
        continue;
      }

      const result = this.buildCageGroup(cage, cage.value, puzzle.puzzleSize);
      if (!result) {
        continue;
      }

      allGroups.push(result.group);
      const entries = this.formatNoteEntries(cage, result.eliminations);
      allNoteEntries.push(...entries);
    }

    if (allGroups.length === 0) {
      return null;
    }

    return {
      changeGroups: allGroups,
      details: allNoteEntries.join('; ')
    };
  }

  protected formatNoteEntries(cage: Cage, eliminations: readonly CellElimination[]): string[] {
    const byValue = new Map<number, Cell[]>();
    for (const { cell, values } of eliminations) {
      for (const v of values) {
        let cells = byValue.get(v);
        if (!cells) {
          cells = [];
          byValue.set(v, cells);
        }
        cells.push(cell);
      }
    }

    const unsolvedCount = cage.cells.filter((c) => !c.isSolved).length;
    const cageRef = `@${cage.topLeft.ref}`;
    const entries: string[] = [];
    for (const [value, cells] of [...byValue].sort(([a], [b]) => a - b)) {
      if (cells.length >= unsolvedCount) {
        entries.push(`${cageRef} -${String(value)}`);
      } else if (cells.length === 1 && ensureNonNullable(cells[0]).ref === cage.topLeft.ref) {
        entries.push(`${cageRef} -${String(value)}`);
      } else if (cells.length === 1) {
        entries.push(`${cageRef} ${ensureNonNullable(cells[0]).ref} -${String(value)}`);
      } else {
        const cellRefs = cells.map((c) => c.ref).join(' ');
        entries.push(`${cageRef} (${cellRefs}) -${String(value)}`);
      }
    }

    return entries;
  }

  protected abstract formatReason(eliminatedValues: readonly number[], cageValue: number): string;

  protected formatValues(values: readonly number[]): string {
    return values.length === 1
      ? String(ensureNonNullable(values[0]))
      : `{${values.join('')}}`;
  }

  protected abstract handlesOperator(operator: Operator): boolean;

  protected abstract shouldEliminate(value: number, context: CageContext): boolean;

  private buildCageGroup(
    cage: Cage,
    cageValue: number,
    puzzleSize: number
  ): CageGroupResult | null {
    const allValues = new Set<number>();
    const changes: CandidatesStrikethrough[] = [];
    const eliminations: CellElimination[] = [];

    for (const cell of cage.cells) {
      if (cell.isSolved) {
        continue;
      }

      const otherCells = cage.cells.filter((c) => c !== cell && !c.isSolved);
      const solvedValues = cage.cells.filter((c) => c.isSolved).map((c) => ensureNonNullable(c.value));
      const context: CageContext = {
        cage,
        cageValue,
        cell,
        cellCount: cage.cells.length,
        otherCells,
        puzzleSize,
        solvedProduct: solvedValues.reduce((p, v) => p * v, 1),
        solvedSum: solvedValues.reduce((s, v) => s + v, 0)
      };

      const eliminated: number[] = [];
      for (const v of cell.getCandidates()) {
        if (this.shouldEliminate(v, context)) {
          eliminated.push(v);
          allValues.add(v);
        }
      }

      if (eliminated.length > 0) {
        changes.push(new CandidatesStrikethrough(cell, eliminated));
        eliminations.push({ cell, values: eliminated });
      }
    }

    if (changes.length === 0) {
      return null;
    }

    const sortedValues = [...allValues].sort((a, b) => a - b);
    return {
      eliminations,
      group: {
        changes,
        reason: this.formatReason(sortedValues, cageValue)
      }
    };
  }
}
