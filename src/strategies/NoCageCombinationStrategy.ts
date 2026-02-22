import type {
  Cell,
  Puzzle
} from '../Puzzle.ts';
import type {
  ChangeGroup,
  Strategy,
  StrategyResult
} from './Strategy.ts';

import { CandidatesStrikethrough } from '../cellChanges/CandidatesStrikethrough.ts';
import { evaluateTuple } from '../combinatorics.ts';
import { ensureNonNullable } from '../typeGuards.ts';
import {
  BINARY_CELL_COUNT,
  canBeOperator,
  deduceOperator
} from './cageOperationBounds.ts';

const MINIMUM_UNSOLVED_CELLS = 2;

interface CageAnalysis {
  readonly operators: readonly string[];
  readonly targets: ReadonlyMap<string, number>;
  readonly validTuples: readonly number[][];
}

export class NoCageCombinationStrategy implements Strategy {
  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const allGroups: ChangeGroup[] = [];
    const cageNoteEntries: string[] = [];

    for (const cage of puzzle.cages) {
      if (cage.cells.length <= 1) {
        continue;
      }

      const cageValue = cage.value;

      const unsolvedCells = cage.cells.filter((c) => !c.isSolved);
      if (unsolvedCells.length < MINIMUM_UNSOLVED_CELLS) {
        continue;
      }

      const operators = this.getOperators(puzzle, cage.operator, cageValue, cage.cells.length, puzzle.puzzleSize);
      if (operators.length === 0) {
        continue;
      }

      const solvedValues = cage.cells.filter((c) => c.isSolved).map((c) => ensureNonNullable(c.value));
      const analysis = this.analyzeCage(unsolvedCells, cageValue, operators, solvedValues);
      const groups = this.buildGroups(unsolvedCells, analysis);
      if (groups.length === 0) {
        continue;
      }

      for (const group of groups) {
        allGroups.push(group);
        cageNoteEntries.push(`@${cage.topLeft.ref}: ${group.reason}`);
      }
    }

    if (allGroups.length === 0) {
      return null;
    }

    return {
      changeGroups: allGroups,
      note: `No cage combination. ${cageNoteEntries.join(', ')}`
    };
  }

  private adjustTarget(
    cageValue: number,
    operator: string,
    solvedValues: readonly number[]
  ): null | number {
    if (solvedValues.length === 0) {
      return cageValue;
    }
    if (operator === '+') {
      return cageValue - solvedValues.reduce((s, v) => s + v, 0);
    }
    if (operator === 'x') {
      const product = solvedValues.reduce((p, v) => p * v, 1);
      if (product === 0 || cageValue % product !== 0) {
        return null;
      }
      return cageValue / product;
    }
    // - and / are binary: if both unsolved, target = cageValue; if 1 unsolved, skip
    return null;
  }

  private analyzeCage(
    unsolvedCells: readonly Cell[],
    cageValue: number,
    operators: readonly string[],
    solvedValues: readonly number[]
  ): CageAnalysis {
    const allValidTuples: number[][] = [];
    const targets = new Map<string, number>();

    for (const operator of operators) {
      const target = this.adjustTarget(cageValue, operator, solvedValues);
      if (target === null) {
        continue;
      }
      targets.set(operator, target);
      const tuples = this.enumerateValidTuples(unsolvedCells, target, operator);
      allValidTuples.push(...tuples);
    }

    return { operators, targets, validTuples: allValidTuples };
  }

  private buildGroups(
    unsolvedCells: readonly Cell[],
    analysis: CageAnalysis
  ): ChangeGroup[] {
    const groups: ChangeGroup[] = [];

    for (let i = 0; i < unsolvedCells.length; i++) {
      const cell = ensureNonNullable(unsolvedCells[i]);
      const validCandidates = new Set<number>();
      for (const tuple of analysis.validTuples) {
        validCandidates.add(ensureNonNullable(tuple[i]));
      }

      const eliminated = cell.getCandidates().filter((v) => !validCandidates.has(v));
      if (eliminated.length === 0) {
        continue;
      }

      const reason = this.formatReason(cell, eliminated, unsolvedCells, analysis);
      groups.push({
        changes: [new CandidatesStrikethrough(cell, eliminated)],
        reason
      });
    }

    return groups;
  }

  private computeNeededValuesForBinary(
    value: number,
    operator: string,
    target: number
  ): number[] {
    switch (operator) {
      case '-':
        return [Math.abs(value - target) > 0 ? value + target : -1, Math.abs(value - target)].filter((v) => v > 0);
      case '/': {
        const results: number[] = [];
        if (value * target > 0) {
          results.push(value * target);
        }
        if (value > 0 && value % target === 0) {
          results.push(value / target);
        }
        return [...new Set(results)].sort((a, b) => a - b);
      }
      case '+':
        return [target - value];
      case 'x': {
        if (value === 0 || target % value !== 0) {
          return [];
        }
        return [target / value];
      }
      default:
        return [];
    }
  }

  private enumerateValidTuples(
    unsolvedCells: readonly Cell[],
    target: number,
    operator: string
  ): number[][] {
    const tuples: number[][] = [];
    const cellCount = unsolvedCells.length;

    function search(tuple: number[], depth: number): void {
      if (depth === cellCount) {
        if (evaluateTuple(tuple, operator) === target) {
          tuples.push([...tuple]);
        }
        return;
      }
      const cell = ensureNonNullable(unsolvedCells[depth]);
      for (const v of cell.getCandidates()) {
        let valid = true;
        for (let i = 0; i < depth; i++) {
          if (ensureNonNullable(tuple[i]) === v) {
            const prevCell = ensureNonNullable(unsolvedCells[i]);
            if (prevCell.row === cell.row || prevCell.column === cell.column) {
              valid = false;
              break;
            }
          }
        }
        if (!valid) {
          continue;
        }
        tuple.push(v);
        search(tuple, depth + 1);
        tuple.pop();
      }
    }

    search([], 0);
    return tuples;
  }

  private formatBinaryReason(
    cell: Cell,
    eliminated: readonly number[],
    unsolvedCells: readonly Cell[],
    analysis: CageAnalysis
  ): string {
    const cellIndex = unsolvedCells.indexOf(cell);
    const otherIndex = cellIndex === 0 ? 1 : 0;
    const otherCell = ensureNonNullable(unsolvedCells[otherIndex]);
    const otherCandidates = otherCell.getCandidates();
    const operatorSuffix = analysis.operators.length > 1
      ? ` under ${analysis.operators.join(', ')}`
      : '';
    const reasons: string[] = [];

    for (const v of eliminated) {
      // Compute what value(s) the other cell would need across all operators
      const allNeeded = new Set<number>();
      for (const [operator, target] of analysis.targets) {
        for (const needed of this.computeNeededValuesForBinary(v, operator, target)) {
          if (Number.isInteger(needed) && needed > 0) {
            allNeeded.add(needed);
          }
        }
      }

      const neededArray = [...allNeeded].sort((a, b) => a - b);
      if (neededArray.length === 0) {
        reasons.push(`${String(v)} needs no valid ${otherCell.ref}`);
      } else {
        const neededStr = neededArray.length === 1
          ? `${otherCell.ref}=${String(ensureNonNullable(neededArray[0]))}`
          : `${otherCell.ref} in {${neededArray.join('')}}`;
        reasons.push(`${String(v)} needs ${neededStr}, ${otherCell.ref} has {${otherCandidates.join('')}}`);
      }
    }

    return `${cell.ref} {${eliminated.join('')}} ${reasons.join('; ')}${operatorSuffix}`;
  }

  private formatReason(
    cell: Cell,
    eliminated: readonly number[],
    unsolvedCells: readonly Cell[],
    analysis: CageAnalysis
  ): string {
    if (unsolvedCells.length === BINARY_CELL_COUNT) {
      return this.formatBinaryReason(cell, eliminated, unsolvedCells, analysis);
    }

    const operatorSuffix = analysis.operators.length > 1
      ? ` under ${analysis.operators.join(', ')}`
      : '';

    return `${cell.ref} {${eliminated.join('')}} ${eliminated.length === 1 ? 'has' : 'have'} no valid combination${operatorSuffix}`;
  }

  private getOperators(
    puzzle: Puzzle,
    cageOperator: string | undefined,
    cageValue: number,
    cellCount: number,
    puzzleSize: number
  ): string[] {
    if (puzzle.hasOperators && cageOperator) {
      return [cageOperator];
    }
    const deduced = deduceOperator(cageValue, cellCount, puzzleSize);
    if (deduced) {
      return [deduced];
    }

    const possibleOperators = cellCount === BINARY_CELL_COUNT
      ? ['+', '-', 'x', '/']
      : ['+', 'x'];

    return possibleOperators.filter((op) => canBeOperator(op, cageValue, cellCount, puzzleSize));
  }
}
