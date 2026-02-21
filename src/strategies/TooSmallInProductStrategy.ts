import type { CageContext } from './CageOperationStrategy.ts';

import {
  BINARY_CELL_COUNT,
  computeLatinSquareBound
} from './cageOperationBounds.ts';
import { CageOperationStrategy } from './CageOperationStrategy.ts';

export class TooSmallInProductStrategy extends CageOperationStrategy {
  protected readonly notePrefix = 'Too small in product';

  protected formatReason(eliminatedValues: readonly number[], _cageValue: number): string {
    return `${this.formatValues(eliminatedValues)} too small`;
  }

  protected handlesOperator(operator: string | undefined): boolean {
    return operator === 'x';
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
    if (ctx.otherCells.length === 0) {
      return quotient > 1;
    }
    if (ctx.cellCount === BINARY_CELL_COUNT) {
      return quotient > ctx.puzzleSize;
    }
    const maxOtherProduct = computeLatinSquareBound(ctx.cell, ctx.otherCells, value, ctx.puzzleSize, 'product', 'max');
    return quotient > maxOtherProduct;
  }
}
