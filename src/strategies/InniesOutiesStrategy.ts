import type {
  Cage,
  House,
  Puzzle
} from '../Puzzle.ts';
import type {
  ChangeGroup,
  Strategy,
  StrategyResult
} from './Strategy.ts';

import { buildAutoEliminateGroup } from '../cageConstraints.ts';
import { CandidatesStrikethrough } from '../cellChanges/CandidatesStrikethrough.ts';
import {
  Cell,
  Operator
} from '../Puzzle.ts';
import { ensureNonNullable } from '../typeGuards.ts';

interface CageContribution {
  readonly innerCells: readonly Cell[];
  readonly known: boolean;
  readonly value: number;
}

export class InniesOutiesStrategy implements Strategy {
  public readonly name = 'Innies/Outies';

  public tryApply(puzzle: Puzzle): null | StrategyResult {
    const allGroups: ChangeGroup[] = [];
    const allNoteEntries: string[] = [];
    const houseTotal = this.computeHouseTotal(puzzle.puzzleSize, Operator.Plus);

    for (const house of puzzle.houses) {
      this.analyzeHouse(house, puzzle, houseTotal, allGroups, allNoteEntries);
    }

    if (allGroups.length === 0) {
      return null;
    }

    return {
      changeGroups: allGroups,
      details: allNoteEntries.join('; ')
    };
  }

  private analyzeHouse(
    house: House,
    puzzle: Puzzle,
    houseTotal: number,
    allGroups: ChangeGroup[],
    allNoteEntries: string[]
  ): void {
    // Group cells by cage and compute each cage's contribution
    const cageMap = new Map<Cage, Cell[]>();
    for (const cell of house.cells) {
      const existing = cageMap.get(cell.cage);
      if (existing) {
        existing.push(cell);
      } else {
        cageMap.set(cell.cage, [cell]);
      }
    }

    let knownSum = 0;
    const unsolvedUnknown: Cell[] = [];

    for (const [cage, innerCells] of cageMap) {
      const contribution = this.getCageContribution(cage, innerCells);
      if (!contribution.known) {
        // Cage contribution unknown, but individually solved cells still
        // Contribute their known values to the house sum
        for (const cell of contribution.innerCells) {
          if (cell.isSolved) {
            knownSum += ensureNonNullable(cell.value);
          } else {
            unsolvedUnknown.push(cell);
          }
        }
        continue;
      }
      knownSum += contribution.value;
    }

    const remaining = houseTotal - knownSum;

    if (unsolvedUnknown.length === 0 || remaining < 1) {
      return;
    }

    const houseLabel = `${house.type} ${house.label}`;

    if (unsolvedUnknown.length === 1) {
      const cell = ensureNonNullable(unsolvedUnknown[0]);
      if (remaining >= 1 && remaining <= puzzle.puzzleSize && cell.hasCandidate(remaining)) {
        const reason = `${houseLabel} sum ${String(remaining)}`;
        allGroups.push(buildAutoEliminateGroup({ cell, value: remaining }, reason));
        allNoteEntries.push(`${houseLabel} sum ${String(remaining)}, ${cell.ref} = ${String(remaining)}`);
      }
    } else {
      this.eliminateFromMultipleCells(
        unsolvedUnknown,
        remaining,
        puzzle.puzzleSize,
        houseLabel,
        allGroups,
        allNoteEntries
      );
    }
  }

  private computeHouseTotal(puzzleSize: number, operator: Operator): number {
    if (operator === Operator.Plus) {
      return puzzleSize * (puzzleSize + 1) / DIVISOR_FOR_TRIANGULAR;
    }
    // Product: n!
    let product = 1;
    for (let i = 1; i <= puzzleSize; i++) {
      product *= i;
    }
    return product;
  }

  private eliminateFromMultipleCells(
    cells: readonly Cell[],
    remaining: number,
    puzzleSize: number,
    houseLabel: string,
    allGroups: ChangeGroup[],
    allNoteEntries: string[]
  ): void {
    // For multiple unknown cells, the minimum possible sum of (cells.length - 1) other cells
    // Is 1+2+...+(cells.length-1) and max is puzzleSize + (puzzleSize-1) + ...
    // A cell's value cannot exceed remaining - minOthers
    // And cannot be less than remaining - maxOthers
    const cellCount = cells.length;
    const otherCount = cellCount - 1;

    // Minimum sum of otherCount distinct values from 1..puzzleSize
    let minOthers = 0;
    for (let i = 1; i <= otherCount; i++) {
      minOthers += i;
    }

    // Maximum sum of otherCount distinct values from 1..puzzleSize
    let maxOthers = 0;
    for (let i = 0; i < otherCount; i++) {
      maxOthers += puzzleSize - i;
    }

    const maxValue = remaining - minOthers;
    const minValue = remaining - maxOthers;

    const changes: CandidatesStrikethrough[] = [];
    for (const cell of cells) {
      const toEliminate = cell.getCandidates().filter(
        (v) => v > maxValue || v < minValue
      );
      if (toEliminate.length > 0) {
        changes.push(new CandidatesStrikethrough(cell, toEliminate));
      }
    }

    if (changes.length > 0) {
      changes.sort((a, b) => Cell.compare(a.cell, b.cell));
      const cellRefs = cells.map((c) => c.ref).join(' ');
      const reason = `${houseLabel} sum ${String(remaining)} (${cellRefs})`;
      allGroups.push({ changes, reason });
      allNoteEntries.push(`${houseLabel} sum ${String(remaining)} (${cellRefs})`);
    }
  }

  private getCageContribution(cage: Cage, innerCells: readonly Cell[]): CageContribution {
    // Single-cell cage: value is always known regardless of operator
    if (cage.cells.length === SINGLE_CELL_COUNT) {
      return { innerCells, known: true, value: cage.value };
    }

    // Only handle + cages for innies/outies sum constraint
    if (cage.operator !== Operator.Plus) {
      return { innerCells, known: false, value: 0 };
    }

    const outerCells = cage.cells.filter((c) => !innerCells.includes(c));

    // Fully contained: all cage cells are in the house
    if (outerCells.length === 0) {
      return { innerCells, known: true, value: cage.value };
    }

    // Partially overlapping: check if all outer cells are solved
    const allOuterSolved = outerCells.every((c) => c.isSolved);
    if (!allOuterSolved) {
      return { innerCells, known: false, value: 0 };
    }

    const outerSum = outerCells.reduce((sum, c) => sum + ensureNonNullable(c.value), 0);
    return { innerCells, known: true, value: cage.value - outerSum };
  }
}

const DIVISOR_FOR_TRIANGULAR = 2;
const SINGLE_CELL_COUNT = 1;
