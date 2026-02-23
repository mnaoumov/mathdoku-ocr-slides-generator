import type { CageContext } from './CageOperationStrategy.ts';

import { Operator } from '../Puzzle.ts';
import { computeLatinSquareBound } from './cageOperationBounds.ts';
import { CageOperationStrategy } from './CageOperationStrategy.ts';

export class TooSmallForSumStrategy extends CageOperationStrategy {
  public readonly name = 'Too small for sum';

  protected formatReason(eliminatedValues: readonly number[], _cageValue: number): string {
    return `${this.formatValues(eliminatedValues)} too small`;
  }

  protected handlesOperator(operator: Operator): boolean {
    return operator === Operator.Plus;
  }

  protected shouldEliminate(value: number, ctx: CageContext): boolean {
    const remainder = ctx.cageValue - value - ctx.solvedSum;
    if (ctx.otherCells.length === 0) {
      return remainder > 0;
    }
    const maxOtherSum = computeLatinSquareBound(ctx.cell, ctx.otherCells, value, ctx.puzzleSize, 'sum', 'max');
    return remainder > maxOtherSum;
  }
}
