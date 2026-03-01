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
import { ensureNonNullable } from '../typeGuards.ts';

const DEFINING_LINE_COUNT = 2;

export class XWingStrategy implements Strategy {
  public readonly name = 'X-Wing';

  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const allGroups: ChangeGroup[] = [];
    const allNoteEntries: string[] = [];

    for (let value = 1; value <= puzzle.puzzleSize; value++) {
      this.findXWings(puzzle.columns, puzzle.rows, value, 'column', allGroups, allNoteEntries);
      this.findXWings(puzzle.rows, puzzle.columns, value, 'row', allGroups, allNoteEntries);
    }

    if (allGroups.length === 0) {
      return null;
    }

    return {
      changeGroups: allGroups,
      details: allNoteEntries.join(', ')
    };
  }

  private findXWings(
    definingLines: readonly House[],
    crossLines: readonly House[],
    value: number,
    definingType: 'column' | 'row',
    allGroups: ChangeGroup[],
    allNoteEntries: string[]
  ): void {
    for (const pair of generateSubsets(definingLines, DEFINING_LINE_COUNT)) {
      const line1 = ensureNonNullable(pair[0]);
      const line2 = ensureNonNullable(pair[1]);
      const cells1 = line1.cells.filter((c) => !c.isSolved && c.hasCandidate(value));
      const cells2 = line2.cells.filter((c) => !c.isSolved && c.hasCandidate(value));

      if (cells1.length !== DEFINING_LINE_COUNT || cells2.length !== DEFINING_LINE_COUNT) {
        continue;
      }

      const crossIds1 = cells1.map((c) => definingType === 'column' ? c.row.id : c.column.id);
      const crossIds2 = cells2.map((c) => definingType === 'column' ? c.row.id : c.column.id);

      if (crossIds1[0] !== crossIds2[0] || crossIds1[1] !== crossIds2[1]) {
        continue;
      }

      const cornerCells = new Set([...cells1, ...cells2]);
      const changes: CandidatesStrikethrough[] = [];

      for (const crossId of crossIds1) {
        const crossLine = crossLines[crossId - 1];
        if (!crossLine) {
          continue;
        }
        for (const cell of crossLine.cells) {
          if (!cornerCells.has(cell) && !cell.isSolved && cell.hasCandidate(value)) {
            changes.push(new CandidatesStrikethrough(cell, [value]));
          }
        }
      }

      if (changes.length === 0) {
        continue;
      }

      changes.sort((a, b) => Cell.compare(a.cell, b.cell));

      const crossType = definingType === 'column' ? 'row' : 'column';
      const lineLabels = [line1.label, line2.label].join(',');
      const crossLabels = crossIds1.map((id) => crossLines[id - 1]?.label ?? String(id)).join(',');
      const reason = `${String(value)} only in ${crossType}s ${crossLabels} of ${definingType}s ${lineLabels}`;
      allGroups.push({ changes, reason });
      allNoteEntries.push(`${String(value)} ${definingType}s ${lineLabels} ${crossType}s ${crossLabels}`);
    }
  }
}
