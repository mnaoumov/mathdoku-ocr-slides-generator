import type { Cage } from '../Puzzle.ts';
import type {
  CageContext,
  CellElimination
} from './CageOperationStrategy.ts';

import { Operator } from '../Puzzle.ts';
import { CageOperationStrategy } from './CageOperationStrategy.ts';

export class DoesNotDivideProductStrategy extends CageOperationStrategy {
  public readonly name = 'Doesn\'t divide product';

  protected override formatNoteEntries(cage: Cage, eliminations: readonly CellElimination[]): string[] {
    const unsolvedCount = cage.cells.filter((c) => !c.isSolved).length;
    const cageRef = `@${cage.topLeft.ref}`;

    if (eliminations.length >= unsolvedCount) {
      const allValues = new Set<number>();
      for (const { values } of eliminations) {
        for (const v of values) {
          allValues.add(v);
        }
      }
      return [`${cageRef} -${[...allValues].sort((a, b) => a - b).join('')}`];
    }

    const entries: string[] = [];
    for (const { cell, values } of eliminations) {
      entries.push(`${cageRef} ${cell.ref === cage.topLeft.ref ? '' : `${cell.ref} `}-${values.join('')}`);
    }
    return entries;
  }

  protected formatReason(eliminatedValues: readonly number[], cageValue: number): string {
    const valueStr = this.formatValues(eliminatedValues);
    return eliminatedValues.length === 1
      ? `${valueStr} doesn't divide ${String(cageValue)}`
      : `${valueStr} don't divide ${String(cageValue)}`;
  }

  protected handlesOperator(operator: Operator): boolean {
    return operator === Operator.Times;
  }

  protected shouldEliminate(value: number, ctx: CageContext): boolean {
    if (ctx.cageValue % value !== 0) {
      return true;
    }
    const totalProduct = value * ctx.solvedProduct;
    return ctx.cageValue % totalProduct !== 0;
  }
}
