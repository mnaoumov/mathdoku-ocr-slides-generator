import type { Strategy } from './Strategy.ts';

import { DeterminedByCageStrategy } from './DeterminedByCageStrategy.ts';
import { DoesNotDivideProductStrategy } from './DoesNotDivideProductStrategy.ts';
import { FillAllCandidatesStrategy } from './FillAllCandidatesStrategy.ts';
import { HiddenSingleStrategy } from './HiddenSingleStrategy.ts';
import { LastCellInCageStrategy } from './LastCellInCageStrategy.ts';
import { NakedSetStrategy } from './NakedSetStrategy.ts';
import { NoCageCombinationStrategy } from './NoCageCombinationStrategy.ts';
import { SingleCandidateStrategy } from './SingleCandidateStrategy.ts';
import { SingleCellCageStrategy } from './SingleCellCageStrategy.ts';
import { TooBigInProductStrategy } from './TooBigInProductStrategy.ts';
import { TooBigInSumStrategy } from './TooBigInSumStrategy.ts';
import { TooSmallInProductStrategy } from './TooSmallInProductStrategy.ts';
import { TooSmallInSumStrategy } from './TooSmallInSumStrategy.ts';
import { UniqueCageMultisetStrategy } from './UniqueCageMultisetStrategy.ts';

const MIN_NAKED_SET_SIZE = 2;

export function createInitialStrategies(): Strategy[] {
  return [
    new FillAllCandidatesStrategy(),
    new SingleCellCageStrategy(),
    new UniqueCageMultisetStrategy(),
    new DoesNotDivideProductStrategy(),
    new TooSmallInSumStrategy(),
    new TooBigInSumStrategy(),
    new TooSmallInProductStrategy(),
    new TooBigInProductStrategy()
  ];
}

export function createStrategies(size: number): Strategy[] {
  return [
    new SingleCandidateStrategy(),
    new HiddenSingleStrategy(),
    new LastCellInCageStrategy(),
    new DeterminedByCageStrategy(),
    new NoCageCombinationStrategy(),
    ...Array.from({ length: size - MIN_NAKED_SET_SIZE }, (_, i) => new NakedSetStrategy(i + MIN_NAKED_SET_SIZE))
  ];
}
