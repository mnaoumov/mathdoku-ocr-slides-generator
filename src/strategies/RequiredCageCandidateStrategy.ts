import type {
  Cage,
  House,
  Puzzle
} from '../Puzzle.ts';
import type {
  ChangeGroup,
  Strategy,
  StrategyResult
} from './Strategy.ts';

import { CandidatesStrikethrough } from '../cellChanges/CandidatesStrikethrough.ts';
import {
  Cell,
  Operator
} from '../Puzzle.ts';
import { ensureNonNullable } from '../typeGuards.ts';
import {
  adjustTargetForSolvedCells,
  enumerateValidTuples,
  getOperatorsForCage
} from './cageTupleAnalysis.ts';

const MINIMUM_CAGE_CELLS = 2;
const MINIMUM_UNSOLVED_CELLS = 2;

export class RequiredCageCandidateStrategy implements Strategy {
  public readonly name = 'Required cage candidate';

  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const allGroups: ChangeGroup[] = [];
    const allNoteEntries: string[] = [];

    for (const cage of puzzle.cages) {
      if (cage.cells.length < MINIMUM_CAGE_CELLS) {
        continue;
      }

      const sharedHouse = this.findSharedHouse(cage);
      if (!sharedHouse) {
        continue;
      }

      const unsolvedCells = cage.cells.filter((c) => !c.isSolved);
      if (unsolvedCells.length < MINIMUM_UNSOLVED_CELLS) {
        continue;
      }

      const operators = getOperatorsForCage(puzzle.hasOperators, cage.operator, cage.value, cage.cells, puzzle.puzzleSize);
      if (operators.length === 0) {
        continue;
      }

      const solvedValues = cage.cells.filter((c) => c.isSolved).map((c) => ensureNonNullable(c.value));
      const validTuples = this.collectValidTuples(unsolvedCells, cage.value, operators, solvedValues);
      if (validTuples.length === 0) {
        continue;
      }

      const requiredValues = this.findRequiredValues(validTuples, puzzle.puzzleSize);
      const cageSet = new Set(cage.cells);
      const cageRef = `@${cage.topLeft.ref}`;
      const houseLabel = `${sharedHouse.type} ${sharedHouse.label}`;

      for (const value of requiredValues) {
        const changes: CandidatesStrikethrough[] = [];
        for (const cell of sharedHouse.cells) {
          if (!cageSet.has(cell) && !cell.isSolved && cell.hasCandidate(value)) {
            changes.push(new CandidatesStrikethrough(cell, [value]));
          }
        }
        if (changes.length === 0) {
          continue;
        }

        changes.sort((a, b) => Cell.compare(a.cell, b.cell));
        const reason = `${cageRef} requires ${String(value)} in ${houseLabel}`;
        allGroups.push({ changes, reason });
        const eliminatedRefs = changes.map((c) => c.cell.ref).join(' ');
        allNoteEntries.push(`${cageRef} -${String(value)} ${houseLabel} ${eliminatedRefs}`);
      }
    }

    if (allGroups.length === 0) {
      return null;
    }

    return {
      changeGroups: allGroups,
      details: allNoteEntries.join('; ')
    };
  }

  private collectValidTuples(
    unsolvedCells: readonly Cell[],
    cageValue: number,
    operators: readonly Operator[],
    solvedValues: readonly number[]
  ): number[][] {
    const allValidTuples: number[][] = [];

    for (const operator of operators) {
      const target = adjustTargetForSolvedCells(cageValue, operator, solvedValues);
      if (target === null) {
        continue;
      }
      const tuples = enumerateValidTuples(unsolvedCells, target, operator);
      allValidTuples.push(...tuples);
    }

    return allValidTuples;
  }

  private findRequiredValues(validTuples: readonly number[][], puzzleSize: number): number[] {
    const required: number[] = [];
    for (let value = 1; value <= puzzleSize; value++) {
      if (validTuples.every((tuple) => tuple.includes(value))) {
        required.push(value);
      }
    }
    return required;
  }

  private findSharedHouse(cage: Cage): House | null {
    const firstCell = ensureNonNullable(cage.cells[0]);

    if (cage.cells.every((c) => c.row === firstCell.row)) {
      return firstCell.row;
    }
    if (cage.cells.every((c) => c.column === firstCell.column)) {
      return firstCell.column;
    }

    return null;
  }
}
