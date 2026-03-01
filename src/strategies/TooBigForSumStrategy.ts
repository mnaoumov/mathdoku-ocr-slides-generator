import type { CageContext } from './CageOperationStrategy.ts';

import { Operator } from '../Puzzle.ts';
import {
  AggregateType,
  BoundType,
  computeLatinSquareBound
} from './cageOperationBounds.ts';
import { CageOperationStrategy } from './CageOperationStrategy.ts';

export class TooBigForSumStrategy extends CageOperationStrategy {
  public readonly name = 'Too big for sum';

  protected formatReason(eliminatedValues: readonly number[], _cageValue: number): string {
    return `${this.formatValues(eliminatedValues)} too big`;
  }

  protected handlesOperator(operator: Operator): boolean {
    return operator === Operator.Plus;
  }

  protected shouldEliminate(value: number, ctx: CageContext): boolean {
    const remainder = ctx.cageValue - value - ctx.solvedSum;
    if (ctx.otherCells.length === 0) {
      return remainder < 0;
    }
    const minOtherSum = computeLatinSquareBound(ctx.cell, ctx.otherCells, value, ctx.puzzleSize, AggregateType.Sum, BoundType.Min);
    return remainder < minOtherSum;
  }
}
