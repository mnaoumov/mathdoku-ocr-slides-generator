import type {
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
import { Cell } from '../Puzzle.ts';

const XWING_SIZE = 2;
const SWORDFISH_SIZE = 3;
const JELLYFISH_SIZE = 4;

const FISH_NAMES: Record<number, string> = {
  [JELLYFISH_SIZE]: 'Jellyfish',
  [SWORDFISH_SIZE]: 'Swordfish',
  [XWING_SIZE]: 'X-Wing'
};

export class FishStrategy implements Strategy {
  public readonly name: string;

  public constructor(private readonly lineCount: number) {
    this.name = FISH_NAMES[lineCount] ?? `${String(lineCount)}-Fish`;
  }

  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const allGroups: ChangeGroup[] = [];
    const allNoteEntries: string[] = [];

    for (let value = 1; value <= puzzle.puzzleSize; value++) {
      this.findFish(puzzle.columns, puzzle.rows, value, 'column', allGroups, allNoteEntries);
      this.findFish(puzzle.rows, puzzle.columns, value, 'row', allGroups, allNoteEntries);
    }

    if (allGroups.length === 0) {
      return null;
    }

    return {
      changeGroups: allGroups,
      details: allNoteEntries.join('; ')
    };
  }

  private findFish(
    definingLines: readonly House[],
    crossLines: readonly House[],
    value: number,
    definingType: 'column' | 'row',
    allGroups: ChangeGroup[],
    allNoteEntries: string[]
  ): void {
    for (const subset of generateSubsets(definingLines, this.lineCount)) {
      const candidateCellsByLine = subset.map(
        (line) => line.cells.filter((c) => !c.isSolved && c.hasCandidate(value))
      );

      // Each defining line must have at most lineCount candidate cells
      if (candidateCellsByLine.some((cells) => cells.length === 0 || cells.length > this.lineCount)) {
        continue;
      }

      // Collect the union of cross-line IDs
      const crossIdSet = new Set<number>();
      for (const cells of candidateCellsByLine) {
        for (const cell of cells) {
          crossIdSet.add(definingType === 'column' ? cell.row.id : cell.column.id);
        }
      }

      // The union must be exactly lineCount cross-lines
      if (crossIdSet.size !== this.lineCount) {
        continue;
      }

      const allFishCells = new Set(candidateCellsByLine.flat());
      const changes: CandidatesStrikethrough[] = [];

      for (const crossId of crossIdSet) {
        const crossLine = crossLines[crossId - 1];
        if (!crossLine) {
          continue;
        }
        for (const cell of crossLine.cells) {
          if (!allFishCells.has(cell) && !cell.isSolved && cell.hasCandidate(value)) {
            changes.push(new CandidatesStrikethrough(cell, [value]));
          }
        }
      }

      if (changes.length === 0) {
        continue;
      }

      changes.sort((a, b) => Cell.compare(a.cell, b.cell));

      const crossType = definingType === 'column' ? 'row' : 'column';
      const lineLabels = subset.map((line) => line.label).join('');
      const crossLabels = [...crossIdSet].sort((a, b) => a - b)
        .map((id) => crossLines[id - 1]?.label ?? String(id)).join('');
      const reason = `${String(value)} ${definingType}s (${lineLabels}) ${crossType}s (${crossLabels})`;
      allGroups.push({ changes, reason });
      allNoteEntries.push(`${String(value)} ${definingType}s (${lineLabels}) ${crossType}s (${crossLabels})`);
    }
  }
}
