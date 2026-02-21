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
import { ensureNonNullable } from '../typeGuards.ts';
import { deduceOperator } from './cageOperationBounds.ts';

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

export abstract class CageOperationStrategy implements Strategy {
  protected abstract readonly notePrefix: string;

  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const allGroups: ChangeGroup[] = [];
    const cageNoteEntries: string[] = [];

    for (const cage of puzzle.cages) {
      if (cage.cells.length <= 1) {
        continue;
      }

      const cageValue = cage.value ?? (cage.label ? parseInt(cage.label, 10) : undefined);
      if (cageValue === undefined || isNaN(cageValue)) {
        continue;
      }

      const effectiveOperator = puzzle.hasOperators && cage.operator
        ? cage.operator
        : deduceOperator(cageValue, cage.cells.length, puzzle.puzzleSize);

      if (!this.handlesOperator(effectiveOperator)) {
        continue;
      }

      const group = this.buildCageGroup(cage, cageValue, puzzle.puzzleSize);
      if (!group) {
        continue;
      }

      allGroups.push(group);
      cageNoteEntries.push(`@${cage.topLeft.ref}: ${group.reason}`);
    }

    if (allGroups.length === 0) {
      return null;
    }

    return {
      changeGroups: allGroups,
      note: `${this.notePrefix}. ${cageNoteEntries.join(', ')}`
    };
  }

  protected abstract formatReason(eliminatedValues: readonly number[], cageValue: number): string;

  protected formatValues(values: readonly number[]): string {
    return values.length === 1
      ? String(ensureNonNullable(values[0]))
      : `{${values.join('')}}`;
  }

  protected abstract handlesOperator(operator: string | undefined): boolean;

  protected abstract shouldEliminate(value: number, context: CageContext): boolean;

  private buildCageGroup(
    cage: Cage,
    cageValue: number,
    puzzleSize: number
  ): ChangeGroup | null {
    const allValues = new Set<number>();
    const changes: CandidatesStrikethrough[] = [];

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
      }
    }

    if (changes.length === 0) {
      return null;
    }

    const sortedValues = [...allValues].sort((a, b) => a - b);
    return {
      changes,
      reason: this.formatReason(sortedValues, cageValue)
    };
  }
}
