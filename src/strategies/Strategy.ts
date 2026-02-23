import type { CellChange } from '../cellChanges/CellChange.ts';
import type { Puzzle } from '../Puzzle.ts';

export interface ChangeGroup {
  readonly changes: readonly CellChange[];
  readonly reason: string;
}

export interface Strategy {
  readonly name: string;
  tryApply(puzzle: Puzzle): null | StrategyResult;
}

export interface StrategyResult {
  readonly changeGroups: readonly ChangeGroup[];
  readonly details?: string;
}

export function buildNote(name: string, details?: string): string {
  return details === undefined ? name : `${name}: ${details}`;
}
