import type {
  CellValueSetter,
  Puzzle
} from '../Puzzle.ts';
import type {
  ChangeGroup,
  Strategy,
  StrategyResult
} from './Strategy.ts';

import { buildAutoEliminateGroup } from '../cageConstraints.ts';
import { ensureNonNullable } from '../typeGuards.ts';

export class SingleCandidateStrategy implements Strategy {
  public readonly name = 'Single candidate';
  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const results: CellValueSetter[] = [];
    for (const cell of puzzle.cells) {
      if (cell.isSolved) {
        continue;
      }
      const cands = cell.getCandidates();
      if (cands.length === 1) {
        results.push({ cell, value: ensureNonNullable(cands[0]) });
      }
    }
    if (results.length === 0) {
      return null;
    }
    const changeGroups: ChangeGroup[] = results.map(
      (setter) => buildAutoEliminateGroup(setter, setter.cell.ref)
    );
    const cellRefs = results.map((r) => r.cell.ref).join(', ');
    return { changeGroups, details: cellRefs };
  }
}
