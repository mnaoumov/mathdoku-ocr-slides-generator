import type { CageContext } from './CageOperationStrategy.ts';

import { Operator } from '../Puzzle.ts';
import {
  BINARY_CELL_COUNT,
  computeLatinSquareBound
} from './cageOperationBounds.ts';
import { CageOperationStrategy } from './CageOperationStrategy.ts';

export class TooBigForProductStrategy extends CageOperationStrategy {
  public readonly name = 'Too big for product';

  protected formatReason(eliminatedValues: readonly number[], _cageValue: number): string {
    return `${this.formatValues(eliminatedValues)} too big`;
  }

  protected handlesOperator(operator: Operator): boolean {
    return operator === Operator.Times;
  }

  protected shouldEliminate(value: number, ctx: CageContext): boolean {
    if (ctx.cageValue % value !== 0) {
      return false;
    }
    const totalProduct = value * ctx.solvedProduct;
    if (ctx.cageValue % totalProduct !== 0) {
      return false;
    }
    const quotient = ctx.cageValue / totalProduct;
    if (ctx.otherCells.length === 0 || ctx.cellCount === BINARY_CELL_COUNT) {
      return false;
    }
    const minOtherProduct = computeLatinSquareBound(ctx.cell, ctx.otherCells, value, ctx.puzzleSize, 'product', 'min');
    return quotient < minOtherProduct;
  }
}
