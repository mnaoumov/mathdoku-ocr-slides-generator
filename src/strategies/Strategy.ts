import type { CellChange } from '../cellChanges/CellChange.ts';
import type { Puzzle } from '../Puzzle.ts';

export interface ChangeGroup {
  readonly changes: readonly CellChange[];
  readonly reason: string;
}

export interface Strategy {
  tryApply(puzzle: Puzzle): null | StrategyResult;
}

export interface StrategyResult {
  readonly changeGroups: readonly ChangeGroup[];
  readonly note: string;
}
