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
import { ensureNonNullable } from '../typeGuards.ts';

export class DeterminedByCageStrategy implements Strategy {
  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const changeGroups: ChangeGroup[] = [];
    const affectedRefs: string[] = [];

    for (const cage of puzzle.cages) {
      if (cage.cells.length <= 1) {
        continue;
      }
      const cageValue = cage.value ?? (cage.label ? parseInt(cage.label, 10) : undefined);
      if (cageValue === undefined || isNaN(cageValue)) {
        continue;
      }
      if (cage.operator !== '+' && cage.operator !== 'x') {
        continue;
      }

      const unsolvedCells = cage.cells.filter((c) => !c.isSolved);
      if (unsolvedCells.length < MINIMUM_UNSOLVED_CELLS) {
        continue;
      }

      const solvedValues = cage.cells.filter((c) => c.isSolved).map((c) => ensureNonNullable(c.value));
      const solvedAggregate = cage.operator === '+'
        ? solvedValues.reduce((s, v) => s + v, 0)
        : solvedValues.reduce((p, v) => p * v, 1);

      for (const targetCell of unsolvedCells) {
        const otherCells = unsolvedCells.filter((c) => c !== targetCell);
        const partitionResult = this.tryPartitionIntoNakedSets(otherCells, puzzle);
        if (partitionResult === null) {
          continue;
        }

        const targetValue = this.computeTargetValue(
          ensureNonNullable(cage.operator),
          cageValue,
          solvedAggregate,
          partitionResult
        );
        if (
          targetValue === null
          || targetValue < 1
          || targetValue > puzzle.puzzleSize
          || !Number.isInteger(targetValue)
          || !targetCell.hasCandidate(targetValue)
        ) {
          continue;
        }

        changeGroups.push(buildAutoEliminateGroup({ cell: targetCell, value: targetValue }, targetCell.ref));
        affectedRefs.push(targetCell.ref);
      }
    }

    if (changeGroups.length === 0) {
      return null;
    }

    return {
      changeGroups,
      note: `Determined by cage. ${affectedRefs.join(', ')}`
    };
  }

  private computeTargetValue(
    operator: string,
    cageValue: number,
    solvedAggregate: number,
    otherAggregate: number
  ): null | number {
    if (operator === '+') {
      return cageValue - solvedAggregate - otherAggregate;
    }
    const denominator = solvedAggregate * otherAggregate;
    if (denominator === 0 || cageValue % denominator !== 0) {
      return null;
    }
    return cageValue / denominator;
  }

  private tryPartitionIntoNakedSets(
    otherCells: readonly Cell[],
    puzzle: Puzzle
  ): null | number {
    const uncovered = new Set(otherCells);
    const isMultiplication = otherCells.length > 0
      && ensureNonNullable(otherCells[0]).cage.operator === 'x';
    let aggregate = isMultiplication ? 1 : 0;

    for (const house of puzzle.houses) {
      const houseCells = otherCells.filter((c) => uncovered.has(c) && house.cells.includes(c));
      if (houseCells.length === 0) {
        continue;
      }

      const candidateUnion = new Set<number>();
      for (const cell of houseCells) {
        for (const v of cell.getCandidates()) {
          candidateUnion.add(v);
        }
      }

      if (candidateUnion.size !== houseCells.length) {
        continue;
      }

      for (const cell of houseCells) {
        uncovered.delete(cell);
      }

      if (isMultiplication) {
        let product = 1;
        for (const v of candidateUnion) {
          product *= v;
        }
        aggregate *= product;
      } else {
        let sum = 0;
        for (const v of candidateUnion) {
          sum += v;
        }
        aggregate += sum;
      }
    }

    if (uncovered.size > 0) {
      return null;
    }

    return aggregate;
  }
}

const MINIMUM_UNSOLVED_CELLS = 2;
