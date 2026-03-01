import type { Puzzle } from '../Puzzle.ts';
import type {
  Strategy,
  StrategyResult
} from './Strategy.ts';

import { CandidatesChange } from '../cellChanges/CandidatesChange.ts';
import { range } from '../combinatorics.ts';

export class FillAllCandidatesStrategy implements Strategy {
  public readonly name = 'Filling all candidates';

  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const allValues = range(1, puzzle.puzzleSize + 1);
    const changes = puzzle.cells
      .filter((cell) => !cell.isSolved)
      .map((cell) => new CandidatesChange(cell, allValues));
    return changes.length > 0
      ? { changeGroups: [{ changes, reason: 'initial candidates' }] }
      : null;
  }
}
