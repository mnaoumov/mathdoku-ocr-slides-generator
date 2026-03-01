import type { Strategy } from './Strategy.ts';

import { range } from '../combinatorics.ts';
import { DeterminedByCageStrategy } from './DeterminedByCageStrategy.ts';
import { DoesNotDivideProductStrategy } from './DoesNotDivideProductStrategy.ts';
import { FillAllCandidatesStrategy } from './FillAllCandidatesStrategy.ts';
import { FishStrategy } from './FishStrategy.ts';
import { HiddenSetStrategy } from './HiddenSetStrategy.ts';
import { HiddenSingleStrategy } from './HiddenSingleStrategy.ts';
import { InniesOutiesStrategy } from './InniesOutiesStrategy.ts';
import { LastCellInCageStrategy } from './LastCellInCageStrategy.ts';
import { NakedSetStrategy } from './NakedSetStrategy.ts';
import { NoCageCombinationStrategy } from './NoCageCombinationStrategy.ts';
import { RequiredCageCandidateStrategy } from './RequiredCageCandidateStrategy.ts';
import { SingleCandidateStrategy } from './SingleCandidateStrategy.ts';
import { SingleCellCageStrategy } from './SingleCellCageStrategy.ts';
import { TooBigForProductStrategy } from './TooBigForProductStrategy.ts';
import { TooBigForSumStrategy } from './TooBigForSumStrategy.ts';
import { TooSmallForProductStrategy } from './TooSmallForProductStrategy.ts';
import { TooSmallForSumStrategy } from './TooSmallForSumStrategy.ts';
import { UniqueCageMultisetStrategy } from './UniqueCageMultisetStrategy.ts';

const MIN_FISH_SIZE = 2;
const MIN_NAKED_SET_SIZE = 2;

export function createInitialStrategies(): Strategy[] {
  return [
    new FillAllCandidatesStrategy(),
    new SingleCellCageStrategy(),
    new UniqueCageMultisetStrategy(),
    new DoesNotDivideProductStrategy(),
    new TooSmallForSumStrategy(),
    new TooBigForSumStrategy(),
    new TooSmallForProductStrategy(),
    new TooBigForProductStrategy()
  ];
}

export function createStrategies(puzzleSize: number): Strategy[] {
  return [
    new SingleCandidateStrategy(),
    new HiddenSingleStrategy(),
    new LastCellInCageStrategy(),
    ...range(MIN_NAKED_SET_SIZE, puzzleSize).map((n) => new NakedSetStrategy(n)),
    ...range(MIN_NAKED_SET_SIZE, puzzleSize).map((n) => new HiddenSetStrategy(n)),
    new DeterminedByCageStrategy(),
    new NoCageCombinationStrategy(),
    new RequiredCageCandidateStrategy(),
    new InniesOutiesStrategy(),
    ...range(MIN_FISH_SIZE, Math.floor(puzzleSize / MIN_FISH_SIZE) + 1).map((n) => new FishStrategy(n))
  ];
}
