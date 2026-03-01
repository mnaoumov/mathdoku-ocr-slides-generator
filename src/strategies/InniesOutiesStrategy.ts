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
  readonly maxValue: number;
  readonly minValue: number;
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
    let boundedMin = 0;
    let boundedMax = 0;
    const boundedCells: Cell[] = [];
    const unsolvedUnknown: Cell[] = [];

    for (const [cage, innerCells] of cageMap) {
      const contribution = this.getCageContribution(cage, innerCells);
      if (contribution.known) {
        knownSum += contribution.minValue;
        continue;
      }

      const isBounded = contribution.minValue < contribution.maxValue;
      if (isBounded) {
        // Bounded cage: solved innies contribute exact values, unsolved innies are bounded
        let innerSolvedSum = 0;
        for (const cell of contribution.innerCells) {
          if (cell.isSolved) {
            innerSolvedSum += ensureNonNullable(cell.value);
            knownSum += ensureNonNullable(cell.value);
          } else {
            boundedCells.push(cell);
          }
        }
        boundedMin += contribution.minValue - innerSolvedSum;
        boundedMax += contribution.maxValue - innerSolvedSum;
      } else {
        // Fully unknown cage: solved innies still contribute to knownSum
        for (const cell of contribution.innerCells) {
          if (cell.isSolved) {
            knownSum += ensureNonNullable(cell.value);
          } else {
            unsolvedUnknown.push(cell);
          }
        }
      }
    }

    const houseLabel = `${house.type} ${house.label}`;

    if (unsolvedUnknown.length > 0) {
      // Path A: truly unknown cells exist — use bounded range to constrain remaining
      const remainingMin = houseTotal - knownSum - boundedMax;
      const remainingMax = houseTotal - knownSum - boundedMin;

      if (remainingMin < 1 && remainingMax < 1) {
        return;
      }

      if (unsolvedUnknown.length === 1) {
        this.eliminateSingleCellWithRange(
          ensureNonNullable(unsolvedUnknown[0]),
          remainingMin,
          remainingMax,
          puzzle.puzzleSize,
          houseLabel,
          allGroups,
          allNoteEntries
        );
      } else {
        this.eliminateFromMultipleCells(
          unsolvedUnknown,
          remainingMin,
          remainingMax,
          puzzle.puzzleSize,
          houseLabel,
          allGroups,
          allNoteEntries
        );
      }
    } else if (boundedCells.length > 0) {
      // Path B: no truly unknown cells — bounded cells' sum is exact from house constraint
      const remaining = houseTotal - knownSum;

      if (remaining < 1) {
        return;
      }

      if (boundedCells.length === 1) {
        this.eliminateSingleCellWithRange(
          ensureNonNullable(boundedCells[0]),
          remaining,
          remaining,
          puzzle.puzzleSize,
          houseLabel,
          allGroups,
          allNoteEntries
        );
      } else {
        this.eliminateFromMultipleCells(
          boundedCells,
          remaining,
          remaining,
          puzzle.puzzleSize,
          houseLabel,
          allGroups,
          allNoteEntries
        );
      }
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
    remainingMin: number,
    remainingMax: number,
    puzzleSize: number,
    houseLabel: string,
    allGroups: ChangeGroup[],
    allNoteEntries: string[]
  ): void {
    // For multiple unknown cells, the minimum possible sum of (cells.length - 1) other cells
    // Is 1+2+...+(cells.length-1) and max is puzzleSize + (puzzleSize-1) + ...
    // A cell's value cannot exceed remainingMax - minOthers
    // And cannot be less than remainingMin - maxOthers
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

    const maxValue = remainingMax - minOthers;
    const minValue = remainingMin - maxOthers;

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
      const remainingLabel = remainingMin === remainingMax
        ? `sum ${String(remainingMin)}`
        : `${String(remainingMin)}..${String(remainingMax)}`;
      const reason = `${houseLabel} ${remainingLabel} (${cellRefs})`;
      allGroups.push({ changes, reason });
      allNoteEntries.push(reason);
    }
  }

  private eliminateSingleCellWithRange(
    cell: Cell,
    remainingMin: number,
    remainingMax: number,
    puzzleSize: number,
    houseLabel: string,
    allGroups: ChangeGroup[],
    allNoteEntries: string[]
  ): void {
    if (remainingMin === remainingMax) {
      // Exact remaining — set value if valid
      const remaining = remainingMin;
      if (remaining >= 1 && remaining <= puzzleSize && cell.hasCandidate(remaining)) {
        const reason = `${houseLabel} sum ${String(remaining)}`;
        allGroups.push(buildAutoEliminateGroup({ cell, value: remaining }, reason));
        allNoteEntries.push(`${houseLabel} sum ${String(remaining)}, ${cell.ref} = ${String(remaining)}`);
      }
    } else {
      // Bounded range — eliminate candidates outside [remainingMin, remainingMax]
      const toEliminate = cell.getCandidates().filter(
        (v) => v > remainingMax || v < remainingMin
      );
      if (toEliminate.length > 0) {
        const eliminatedStr = toEliminate.map((v) => `-${String(v)}`).join(' ');
        const rangeLabel = `${String(remainingMin)}..${String(remainingMax)}`;
        const reason = `${houseLabel} ${rangeLabel} ${eliminatedStr}`;
        allGroups.push({ changes: [new CandidatesStrikethrough(cell, toEliminate)], reason });
        allNoteEntries.push(reason);
      }
    }
  }

  private getCageContribution(cage: Cage, innerCells: readonly Cell[]): CageContribution {
    // Single-cell cage: value is always known regardless of operator
    if (cage.cells.length === SINGLE_CELL_COUNT) {
      return { innerCells, known: true, maxValue: cage.value, minValue: cage.value };
    }

    // Only handle + cages for innies/outies sum constraint
    if (cage.operator !== Operator.Plus) {
      return { innerCells, known: false, maxValue: 0, minValue: 0 };
    }

    const outerCells = cage.cells.filter((c) => !innerCells.includes(c));

    // Fully contained: all cage cells are in the house
    if (outerCells.length === 0) {
      return { innerCells, known: true, maxValue: cage.value, minValue: cage.value };
    }

    // Partially overlapping: compute outie sum range
    let outieMinTotal = 0;
    let outieMaxTotal = 0;
    let allOuterSolved = true;
    for (const cell of outerCells) {
      if (cell.isSolved) {
        const v = ensureNonNullable(cell.value);
        outieMinTotal += v;
        outieMaxTotal += v;
      } else {
        allOuterSolved = false;
        const candidates = cell.getCandidates();
        if (candidates.length === 0) {
          return { innerCells, known: false, maxValue: 0, minValue: 0 };
        }
        outieMinTotal += ensureNonNullable(candidates[0]);
        outieMaxTotal += ensureNonNullable(candidates[candidates.length - 1]);
      }
    }

    const innerMin = cage.value - outieMaxTotal;
    const innerMax = cage.value - outieMinTotal;

    if (allOuterSolved) {
      return { innerCells, known: true, maxValue: innerMax, minValue: innerMin };
    }

    // Bounded: unsolved outies give a range for the inner cells' sum
    return { innerCells, known: false, maxValue: innerMax, minValue: innerMin };
  }
}

const DIVISOR_FOR_TRIANGULAR = 2;
const SINGLE_CELL_COUNT = 1;
