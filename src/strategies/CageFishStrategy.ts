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
import { generateSubsets } from '../combinatorics.ts';
import {
  Cell,
  HouseType
} from '../Puzzle.ts';
import { ensureNonNullable } from '../typeGuards.ts';
import {
  collectValidTuples,
  getOperatorsForCage
} from './cageTupleAnalysis.ts';

const CAGE_JELLYFISH_SIZE = 4;
const CAGE_SWORDFISH_SIZE = 3;
const CAGE_X_WING_SIZE = 2;
const MINIMUM_CAGE_CELLS = 2;
const MINIMUM_UNSOLVED_CELLS = 2;

const CAGE_FISH_NAMES: Record<number, string> = {
  [CAGE_JELLYFISH_SIZE]: 'Cage Jellyfish',
  [CAGE_SWORDFISH_SIZE]: 'Cage Swordfish',
  [CAGE_X_WING_SIZE]: 'Cage X-Wing'
};

interface CageValueInfo {
  readonly cage: Cage;
  readonly candidateCells: readonly Cell[];
}

export class CageFishStrategy implements Strategy {
  public readonly name: string;

  public constructor(private readonly cageCount: number) {
    this.name = CAGE_FISH_NAMES[cageCount] ?? `Cage ${String(cageCount)}-Fish`;
  }

  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const allGroups: ChangeGroup[] = [];
    const allNoteEntries: string[] = [];

    for (let value = 1; value <= puzzle.puzzleSize; value++) {
      const cages = this.findCagesRequiringValue(puzzle, value);
      if (cages.length < this.cageCount) {
        continue;
      }

      this.findCageFish(cages, puzzle.rows, value, HouseType.Row, allGroups, allNoteEntries);
      this.findCageFish(cages, puzzle.columns, value, HouseType.Column, allGroups, allNoteEntries);
    }

    if (allGroups.length === 0) {
      return null;
    }

    return {
      changeGroups: allGroups,
      details: allNoteEntries.join('; ')
    };
  }

  private findCageFish(
    cages: readonly CageValueInfo[],
    crossLines: readonly House[],
    value: number,
    crossType: HouseType,
    allGroups: ChangeGroup[],
    allNoteEntries: string[]
  ): void {
    for (const subset of generateSubsets(cages, this.cageCount)) {
      const crossIdSet = new Set<number>();
      for (const info of subset) {
        for (const cell of info.candidateCells) {
          crossIdSet.add(crossType === HouseType.Row ? cell.row.id : cell.column.id);
        }
      }

      if (crossIdSet.size !== this.cageCount) {
        continue;
      }

      const allCageCells = new Set<Cell>();
      for (const info of subset) {
        for (const cell of info.cage.cells) {
          allCageCells.add(cell);
        }
      }

      const changes: CandidatesStrikethrough[] = [];
      for (const crossId of crossIdSet) {
        const crossLine = crossLines[crossId - 1];
        if (!crossLine) {
          continue;
        }
        for (const cell of crossLine.cells) {
          if (!allCageCells.has(cell) && !cell.isSolved && cell.hasCandidate(value)) {
            changes.push(new CandidatesStrikethrough(cell, [value]));
          }
        }
      }

      if (changes.length === 0) {
        continue;
      }

      changes.sort((a, b) => Cell.compare(a.cell, b.cell));

      const cageLabels = subset.map((info) => `@${info.cage.topLeft.ref}`).join(', ');
      const crossLabels = [...crossIdSet].sort((a, b) => a - b)
        .map((id) => ensureNonNullable(crossLines[id - 1]).label).join('');
      const reason = `${cageLabels} require ${String(value)} in ${crossType}s (${crossLabels})`;
      allGroups.push({ changes, reason });
      allNoteEntries.push(reason);
    }
  }

  private findCagesRequiringValue(puzzle: Puzzle, value: number): CageValueInfo[] {
    const result: CageValueInfo[] = [];

    for (const cage of puzzle.cages) {
      if (cage.cells.length < MINIMUM_CAGE_CELLS) {
        continue;
      }

      const unsolvedCells = cage.cells.filter((c) => !c.isSolved);
      if (unsolvedCells.length < MINIMUM_UNSOLVED_CELLS) {
        continue;
      }

      const operators = getOperatorsForCage(cage, puzzle.puzzleSize);
      if (operators.length === 0) {
        continue;
      }

      const candidateCells = unsolvedCells.filter((c) => c.hasCandidate(value));
      if (candidateCells.length === 0) {
        continue;
      }

      const solvedValues = cage.cells.filter((c) => c.isSolved).map((c) => ensureNonNullable(c.value));
      const validTuples = collectValidTuples(unsolvedCells, cage.value, operators, solvedValues);
      if (validTuples.length === 0) {
        continue;
      }

      const isRequired = validTuples.every((tuple) => tuple.includes(value));
      if (!isRequired) {
        continue;
      }

      result.push({ cage, candidateCells });
    }

    return result;
  }
}
