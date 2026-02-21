import type { CageContext } from './CageOperationStrategy.ts';

import { computeLatinSquareBound } from './cageOperationBounds.ts';
import { CageOperationStrategy } from './CageOperationStrategy.ts';

export class TooBigInSumStrategy extends CageOperationStrategy {
  protected readonly notePrefix = 'Too big in sum';

  protected formatReason(eliminatedValues: readonly number[], _cageValue: number): string {
    return `${this.formatValues(eliminatedValues)} too big`;
  }

  protected handlesOperator(operator: string | undefined): boolean {
    return operator === '+';
  }

  protected shouldEliminate(value: number, ctx: CageContext): boolean {
    const remainder = ctx.cageValue - value - ctx.solvedSum;
    if (ctx.otherCells.length === 0) {
      return remainder < 0;
    }
    const minOtherSum = computeLatinSquareBound(ctx.cell, ctx.otherCells, value, ctx.puzzleSize, 'sum', 'min');
    return remainder < minOtherSum;
  }
}
