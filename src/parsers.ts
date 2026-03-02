import { ensureNonNullable } from './typeGuards.ts';

export interface CellRef {
  readonly columnId: number;
  readonly rowId: number;
}

const CHAR_CODE_A = 65;

export function getCellRef(rowId: number, columnId: number): string {
  return String.fromCharCode(CHAR_CODE_A + columnId - 1) + String(rowId);
}

export function parseCellRef(token: string): CellRef {
  const m = /^(?<col>[A-Z])(?<row>[1-9]\d*)$/.exec(token.trim().toUpperCase());
  if (!m) {
    throw new Error(`Bad cell ref: ${token}`);
  }
  const groups = ensureNonNullable(m.groups);
  return {
    columnId: ensureNonNullable(groups['col']).charCodeAt(0) - CHAR_CODE_A + 1,
    rowId: parseInt(ensureNonNullable(groups['row']), 10)
  };
}
