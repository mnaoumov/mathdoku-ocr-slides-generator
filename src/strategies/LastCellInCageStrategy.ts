import type {
  Cell,
  Puzzle
} from '../Puzzle.ts';
import type {
  ChangeGroup,
  Strategy,
  StrategyResult
} from './Strategy.ts';

import { buildAutoEliminateGroup } from '../cageConstraints.ts';
import { CandidatesStrikethrough } from '../cellChanges/CandidatesStrikethrough.ts';
import { Operator } from '../Puzzle.ts';
import { ensureNonNullable } from '../typeGuards.ts';

const BINARY_CELL_COUNT = 2;

export class LastCellInCageStrategy implements Strategy {
  public readonly name = 'Last cell in cage';
  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const changeGroups: ChangeGroup[] = [];
    const affectedRefs: string[] = [];

    for (const cage of puzzle.cages) {
      if (cage.cells.length <= 1) {
        continue;
      }
      const unsolvedCells = cage.cells.filter((c) => !c.isSolved);
      if (unsolvedCells.length !== 1) {
        continue;
      }

      const lastCell = ensureNonNullable(unsolvedCells[0]);
      const solvedValues = cage.cells.filter((c) => c.isSolved).map((c) => ensureNonNullable(c.value));

      const validCandidates = this.findValidCandidates(
        lastCell,
        solvedValues,
        cage.value,
        cage.operator,
        puzzle.hasOperators,
        puzzle.puzzleSize,
        cage.cells.length
      );

      const currentCandidates = lastCell.getCandidates();
      const toEliminate = currentCandidates.filter((v) => !validCandidates.has(v));
      if (toEliminate.length === 0) {
        continue;
      }

      affectedRefs.push(lastCell.ref);
      if (validCandidates.size === 1) {
        const value = ensureNonNullable([...validCandidates][0]);
        changeGroups.push(buildAutoEliminateGroup({ cell: lastCell, value }, lastCell.ref));
      } else {
        changeGroups.push({ changes: [new CandidatesStrikethrough(lastCell, toEliminate)], reason: lastCell.ref });
      }
    }

    if (changeGroups.length === 0) {
      return null;
    }

    return {
      changeGroups,
      details: affectedRefs.join('; ')
    };
  }

  private computeForAddition(solvedValues: readonly number[], cageValue: number, puzzleSize: number): Set<number> {
    const solvedSum = solvedValues.reduce((sum, v) => sum + v, 0);
    const needed = cageValue - solvedSum;
    const result = new Set<number>();
    if (needed >= 1 && needed <= puzzleSize) {
      result.add(needed);
    }
    return result;
  }

  private computeForDivision(solvedValues: readonly number[], cageValue: number, puzzleSize: number): Set<number> {
    if (solvedValues.length !== 1) {
      return new Set<number>();
    }
    const other = ensureNonNullable(solvedValues[0]);
    const result = new Set<number>();
    // LastCell is the larger: lastCell / other = cageValue → lastCell = other * cageValue
    const asLarger = other * cageValue;
    if (asLarger >= 1 && asLarger <= puzzleSize) {
      result.add(asLarger);
    }
    // LastCell is the smaller: other / lastCell = cageValue → lastCell = other / cageValue
    if (cageValue !== 0 && other % cageValue === 0) {
      const asSmaller = other / cageValue;
      if (asSmaller >= 1 && asSmaller <= puzzleSize) {
        result.add(asSmaller);
      }
    }
    return result;
  }

  private computeForMultiplication(solvedValues: readonly number[], cageValue: number, puzzleSize: number): Set<number> {
    const solvedProduct = solvedValues.reduce((prod, v) => prod * v, 1);
    const result = new Set<number>();
    if (solvedProduct === 0) {
      return result;
    }
    if (cageValue % solvedProduct === 0) {
      const needed = cageValue / solvedProduct;
      if (needed >= 1 && needed <= puzzleSize) {
        result.add(needed);
      }
    }
    return result;
  }

  private computeForSubtraction(solvedValues: readonly number[], cageValue: number, puzzleSize: number): Set<number> {
    if (solvedValues.length !== 1) {
      return new Set<number>();
    }
    const other = ensureNonNullable(solvedValues[0]);
    const result = new Set<number>();
    // LastCell - other = cageValue → lastCell = other + cageValue
    const larger = other + cageValue;
    if (larger >= 1 && larger <= puzzleSize) {
      result.add(larger);
    }
    // Other - lastCell = cageValue → lastCell = other - cageValue
    const smaller = other - cageValue;
    if (smaller >= 1 && smaller <= puzzleSize) {
      result.add(smaller);
    }
    return result;
  }

  private findValidCandidates(
    lastCell: Cell,
    solvedValues: readonly number[],
    cageValue: number,
    cageOperator: Operator,
    hasOperators: boolean,
    puzzleSize: number,
    cellCount: number
  ): Set<number> {
    const currentCandidates = new Set(lastCell.getCandidates());

    if (hasOperators && cageOperator !== Operator.Unknown) {
      const computed = this.getValidForOperator(cageOperator, solvedValues, cageValue, puzzleSize);
      return new Set([...computed].filter((v) => currentCandidates.has(v)));
    }

    const operators = cellCount === BINARY_CELL_COUNT
      ? [Operator.Divide, Operator.Minus, Operator.Plus, Operator.Times]
      : [Operator.Plus, Operator.Times];
    const valid = new Set<number>();
    for (const op of operators) {
      for (const v of this.getValidForOperator(op, solvedValues, cageValue, puzzleSize)) {
        if (currentCandidates.has(v)) {
          valid.add(v);
        }
      }
    }
    return valid;
  }

  private getValidForOperator(
    operator: Operator,
    solvedValues: readonly number[],
    cageValue: number,
    puzzleSize: number
  ): Set<number> {
    switch (operator) {
      case Operator.Divide:
        return this.computeForDivision(solvedValues, cageValue, puzzleSize);
      case Operator.Minus:
        return this.computeForSubtraction(solvedValues, cageValue, puzzleSize);
      case Operator.Plus:
        return this.computeForAddition(solvedValues, cageValue, puzzleSize);
      case Operator.Times:
        return this.computeForMultiplication(solvedValues, cageValue, puzzleSize);
      case Operator.Exact:
      case Operator.Unknown:
      default:
        return new Set<number>();
    }
  }
}
