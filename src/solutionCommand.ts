import { z } from 'zod';

import type { CellChange } from './cellChanges/CellChange.ts';

import { CandidatesChange } from './cellChanges/CandidatesChange.ts';
import { CandidatesStrikethrough } from './cellChanges/CandidatesStrikethrough.ts';
import { ValueChange } from './cellChanges/ValueChange.ts';
import {
  getCellRef,
  parseCellRef
} from './parsers.ts';
import { ensureNonNullable } from './typeGuards.ts';

export const solutionCommandSchema = z.record(z.string(), z.union([z.number(), z.string()]));
export type SolutionCommand = z.infer<typeof solutionCommandSchema>;

interface CommandEntry {
  readonly cellRef: string;
  readonly operation: number | string;
}

export function buildCommand(changes: readonly CellChange[]): SolutionCommand {
  // Step 1: Collect ValueChange cells and their values for derived-strikethrough filtering
  const valuePeerSet = new Set<string>();
  for (const change of changes) {
    if (change instanceof ValueChange) {
      for (const peer of change.cell.peers) {
        valuePeerSet.add(`${peer.ref}:${String(change.value)}`);
      }
    }
  }

  // Step 2: Map each primary change to {cellRef, operation}
  const entries: CommandEntry[] = [];
  for (const change of changes) {
    if (change instanceof ValueChange) {
      entries.push({ cellRef: change.cell.ref, operation: `=${String(change.value)}` });
    } else if (change instanceof CandidatesChange) {
      const digits = change.values.join('');
      entries.push({ cellRef: change.cell.ref, operation: parseInt(digits, 10) });
    } else if (change instanceof CandidatesStrikethrough) {
      // Skip derived strikethroughs (peers of value changes with the same value)
      const isDerived = change.values.every((v) => valuePeerSet.has(`${change.cell.ref}:${String(v)}`));
      if (isDerived) {
        continue;
      }
      const digits = change.values.join('');
      entries.push({ cellRef: change.cell.ref, operation: -parseInt(digits, 10) });
    }
  }

  // Step 3: Group by operation value → pick most compact selector
  const byOperation = new Map<number | string, string[]>();
  for (const entry of entries) {
    const key = entry.operation;
    let group = byOperation.get(key);
    if (!group) {
      group = [];
      byOperation.set(key, group);
    }
    group.push(entry.cellRef);
  }

  const command: Record<string, number | string> = {};
  for (const [operation, cellRefs] of byOperation) {
    const selector = buildSelector(cellRefs);
    command[selector] = operation;
  }

  return command;
}

function buildSelector(cellRefs: string[]): string {
  if (cellRefs.length === 1) {
    return ensureNonNullable(cellRefs[0]);
  }

  // Try rectangle detection
  const parsed = cellRefs.map((ref) => ({ ref, ...parseCellRef(ref) }));
  const minRow = Math.min(...parsed.map((p) => p.rowId));
  const maxRow = Math.max(...parsed.map((p) => p.rowId));
  const minCol = Math.min(...parsed.map((p) => p.columnId));
  const maxCol = Math.max(...parsed.map((p) => p.columnId));
  const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
  if (expectedCount === cellRefs.length) {
    // Verify all cells in the rectangle are present
    const refSet = new Set(cellRefs);
    let isRect = true;
    for (let r = minRow; r <= maxRow && isRect; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const ref = getCellRef(r, c);
        if (!refSet.has(ref)) {
          isRect = false;
          break;
        }
      }
    }
    if (isRect) {
      const startRef = getCellRef(minRow, minCol);
      const endRef = getCellRef(maxRow, maxCol);
      return `${startRef}-${endRef}`;
    }
  }

  // Multiple cells — explicit group
  return `(${cellRefs.join(' ')})`;
}
