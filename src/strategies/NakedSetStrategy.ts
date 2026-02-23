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

const NAKED_SET_NAMES: Record<number, string> = {
  [PAIR_SIZE]: 'Naked pair',
  [QUAD_SIZE]: 'Naked quad',
  [TRIPLET_SIZE]: 'Naked triplet'
};

export class NakedSetStrategy implements Strategy {
  public readonly name: string;

  public constructor(private readonly subsetSize: number) {
    this.name = NAKED_SET_NAMES[subsetSize] ?? `Naked set (${String(subsetSize)})`;
  }

  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const changeGroups: ChangeGroup[] = [];

    for (const house of puzzle.houses) {
      const filtered = house.cells.filter((cell) => !cell.isSolved && cell.candidateCount > 0);
      if (filtered.length > this.subsetSize) {
        this.scanHouseForNakedSet(filtered, changeGroups);
      }
    }

    if (changeGroups.length === 0) {
      return null;
    }

    const subsetDescriptions = changeGroups.map((g) => g.reason);
    return {
      changeGroups,
      details: subsetDescriptions.join(', ')
    };
  }

  private scanHouseForNakedSet(
    cells: readonly Cell[],
    changeGroups: ChangeGroup[]
  ): void {
    for (const subset of generateSubsets(cells, this.subsetSize)) {
      const union = new Set<number>();
      for (const cell of subset) {
        for (const v of cell.getCandidates()) {
          union.add(v);
        }
      }

      if (union.size !== this.subsetSize) {
        continue;
      }

      const subsetSet = new Set(subset);
      const changes: CandidatesStrikethrough[] = [];
      for (const cell of cells) {
        if (subsetSet.has(cell)) {
          continue;
        }
        const toEliminate = cell.getCandidates().filter((v) => union.has(v));
        if (toEliminate.length > 0) {
          changes.push(new CandidatesStrikethrough(cell, toEliminate));
        }
      }

      if (changes.length > 0) {
        const reason = `(${subset.map((c) => c.ref).join(' ')})`;
        changes.sort((a, b) => Cell.compare(a.cell, b.cell));
        changeGroups.push({ changes, reason });
      }
    }
  }
}
