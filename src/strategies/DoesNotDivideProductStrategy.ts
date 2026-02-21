import type { CageContext } from './CageOperationStrategy.ts';

import { CageOperationStrategy } from './CageOperationStrategy.ts';

export class DoesNotDivideProductStrategy extends CageOperationStrategy {
  protected readonly notePrefix = 'Doesn\'t divide product';

  protected formatReason(eliminatedValues: readonly number[], cageValue: number): string {
    const valueStr = this.formatValues(eliminatedValues);
    return eliminatedValues.length === 1
      ? `${valueStr} doesn't divide ${String(cageValue)}`
      : `${valueStr} don't divide ${String(cageValue)}`;
  }

  protected handlesOperator(operator: string | undefined): boolean {
    return operator === 'x';
  }

  protected shouldEliminate(value: number, ctx: CageContext): boolean {
    return ctx.cageValue % value !== 0;
  }
}
