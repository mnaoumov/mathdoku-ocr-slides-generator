import type { CellValueSetter } from '../Puzzle.ts';
import type { Puzzle } from '../Puzzle.ts';
import type {
  ChangeGroup,
  Strategy,
  StrategyResult
} from './Strategy.ts';

import { buildAutoEliminateGroup } from '../cageConstraints.ts';
import { ensureNonNullable } from '../typeGuards.ts';

export class SingleCellCageStrategy implements Strategy {
  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const valueSetters: CellValueSetter[] = [];
    for (const cage of puzzle.cages) {
      if (cage.cells.length !== 1) {
        continue;
      }
      valueSetters.push({ cell: ensureNonNullable(cage.cells[0]), value: cage.value });
    }

    if (valueSetters.length === 0) {
      return null;
    }

    const changeGroups: ChangeGroup[] = valueSetters.map(
      (setter) => buildAutoEliminateGroup(setter, setter.cell.ref)
    );
    const cellRefs = valueSetters.map((s) => s.cell.ref).join(', ');
    return { changeGroups, note: `Single cell. ${cellRefs}` };
  }
}
