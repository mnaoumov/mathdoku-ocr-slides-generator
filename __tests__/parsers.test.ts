import {
  describe,
  expect,
  it
} from 'vitest';

import {
  getCellRef,
  parseCellRef
} from '../src/parsers.ts';

describe('getCellRef', () => {
  it('converts row 1 col 1 to A1', () => {
    expect(getCellRef(1, 1)).toBe('A1');
  });

  it('converts row 1 col 5 to E1', () => {
    expect(getCellRef(1, 5)).toBe('E1');
  });

  it('converts row 4 col 3 to C4', () => {
    expect(getCellRef(4, 3)).toBe('C4');
  });
});

describe('parseCellRef', () => {
  it('parses A1', () => {
    expect(parseCellRef('A1')).toEqual({ columnId: 1, rowId: 1 });
  });

  it('parses E5', () => {
    expect(parseCellRef('E5')).toEqual({ columnId: 5, rowId: 5 });
  });

  it('is case-insensitive', () => {
    expect(parseCellRef('b3')).toEqual({ columnId: 2, rowId: 3 });
  });

  it('throws for invalid ref', () => {
    expect(() => parseCellRef('ZZ')).toThrow('Bad cell ref');
  });

  it('throws for empty string', () => {
    expect(() => parseCellRef('')).toThrow('Bad cell ref');
  });
});
