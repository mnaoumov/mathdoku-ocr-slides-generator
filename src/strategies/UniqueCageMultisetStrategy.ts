import type { Puzzle } from '../Puzzle.ts';
import type {
  ChangeGroup,
  Strategy,
  StrategyResult
} from './Strategy.ts';

import {
  applyCageConstraint,
  buildAutoEliminateGroup
} from '../cageConstraints.ts';

export class UniqueCageMultisetStrategy implements Strategy {
  public readonly name = 'Unique cage multiset';
  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const changeGroups: ChangeGroup[] = [];
    const affectedCageRefs: string[] = [];

    for (const cage of puzzle.cages) {
      if (cage.cells.length <= 1) {
        continue;
      }

      const cageRef = `@${cage.topLeft.ref}`;
      const { candidateGroups, valueSetters } = applyCageConstraint({
        cage,
        hasOperators: puzzle.hasOperators,
        puzzleSize: puzzle.puzzleSize
      });

      if (valueSetters.length === 0 && candidateGroups.length === 0) {
        continue;
      }

      affectedCageRefs.push(cageRef);
      changeGroups.push(...candidateGroups);
      for (const setter of valueSetters) {
        changeGroups.push(buildAutoEliminateGroup(setter, setter.cell.ref));
      }
    }

    if (changeGroups.length === 0) {
      return null;
    }

    return {
      changeGroups,
      details: affectedCageRefs.join(', ')
    };
  }
}
