import {
  describe,
  expect,
  it
} from 'vitest';

import {
  assertNonNullable,
  ensureNonNullable
} from '../src/typeGuards.ts';

describe('assertNonNullable', () => {
  it('passes for non-null values', () => {
    expect(() => {
      assertNonNullable(42 as number | undefined);
    }).not.toThrow();
    expect(() => {
      assertNonNullable('hello' as string | undefined);
    }).not.toThrow();
    expect(() => {
      assertNonNullable(0 as number | undefined);
    }).not.toThrow();
    expect(() => {
      assertNonNullable('' as string | undefined);
    }).not.toThrow();
    expect(() => {
      assertNonNullable(false as boolean | undefined);
    }).not.toThrow();
  });

  it('throws for null', () => {
    expect(() => {
      assertNonNullable(null);
    }).toThrow('Value is null');
  });

  it('throws for undefined', () => {
    expect(() => {
      assertNonNullable(undefined);
    }).toThrow('Value is undefined');
  });

  it('throws with custom string message', () => {
    expect(() => {
      assertNonNullable(null, 'custom message');
    }).toThrow('custom message');
  });

  it('throws with custom Error', () => {
    const error = new TypeError('type error');
    expect(() => {
      assertNonNullable(null, error);
    }).toThrow(error);
  });
});

describe('ensureNonNullable', () => {
  it('returns the value for non-null inputs', () => {
    expect(ensureNonNullable(42 as number | undefined)).toBe(42);
    expect(ensureNonNullable('hello' as string | undefined)).toBe('hello');
    expect(ensureNonNullable(0 as number | undefined)).toBe(0);
    expect(ensureNonNullable('' as string | undefined)).toBe('');
    expect(ensureNonNullable(false as boolean | undefined)).toBe(false);
  });

  it('throws for null', () => {
    expect(() => ensureNonNullable(null)).toThrow('Value is null');
  });

  it('throws for undefined', () => {
    expect(() => ensureNonNullable(undefined)).toThrow('Value is undefined');
  });

  it('throws with custom string message', () => {
    expect(() => ensureNonNullable(null, 'custom')).toThrow('custom');
  });
});
