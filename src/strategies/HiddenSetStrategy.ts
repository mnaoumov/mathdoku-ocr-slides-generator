import type { Puzzle } from '../Puzzle.ts';
import type {
  ChangeGroup,
  Strategy,
  StrategyResult
} from './Strategy.ts';

import { CandidatesStrikethrough } from '../cellChanges/CandidatesStrikethrough.ts';
import { generateSubsets } from '../combinatorics.ts';
import { Cell } from '../Puzzle.ts';

const PAIR_SIZE = 2;
const TRIPLET_SIZE = 3;
const QUAD_SIZE = 4;

const HIDDEN_SET_NAMES: Record<number, string> = {
  [PAIR_SIZE]: 'Hidden pair',
  [QUAD_SIZE]: 'Hidden quad',
  [TRIPLET_SIZE]: 'Hidden triplet'
};

export class HiddenSetStrategy implements Strategy {
  public readonly name: string;

  public constructor(private readonly subsetSize: number) {
    this.name = HIDDEN_SET_NAMES[subsetSize] ?? `Hidden set (${String(subsetSize)})`;
  }

  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const changeGroups: ChangeGroup[] = [];

    for (const house of puzzle.houses) {
      const unsolvedCells = house.cells.filter((cell) => !cell.isSolved && cell.candidateCount > 0);
      if (unsolvedCells.length <= this.subsetSize) {
        continue;
      }

      this.scanHouseForHiddenSet(unsolvedCells, changeGroups);
    }

    if (changeGroups.length === 0) {
      return null;
    }

    const subsetDescriptions = changeGroups.map((g) => g.reason);
    return {
      changeGroups,
      details: subsetDescriptions.join('; ')
    };
  }

  private scanHouseForHiddenSet(
    cells: readonly Cell[],
    changeGroups: ChangeGroup[]
  ): void {
    // Collect all candidate values present in the unsolved cells
    const allValues = new Set<number>();
    for (const cell of cells) {
      for (const v of cell.getCandidates()) {
        allValues.add(v);
      }
    }

    const valueArray = [...allValues].sort((a, b) => a - b);
    if (valueArray.length < this.subsetSize) {
      return;
    }

    for (const valueSubset of generateSubsets(valueArray, this.subsetSize)) {
      // Find which cells contain any of these values
      const containingCells = cells.filter(
        (cell) => valueSubset.some((v) => cell.hasCandidate(v))
      );

      // Hidden set: exactly N cells contain these N values
      if (containingCells.length !== this.subsetSize) {
        continue;
      }

      // Eliminate all other candidates from those N cells
      const valueSet = new Set(valueSubset);
      const changes: CandidatesStrikethrough[] = [];
      for (const cell of containingCells) {
        const toEliminate = cell.getCandidates().filter((v) => !valueSet.has(v));
        if (toEliminate.length > 0) {
          changes.push(new CandidatesStrikethrough(cell, toEliminate));
        }
      }

      if (changes.length > 0) {
        changes.sort((a, b) => Cell.compare(a.cell, b.cell));
        const reason = `{${valueSubset.join('')}} (${containingCells.map((c) => c.ref).join(' ')})`;
        changeGroups.push({ changes, reason });
      }
    }
  }
}
