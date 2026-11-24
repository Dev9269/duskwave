import { parsePositiveInt } from './args';

describe('parsePositiveInt', () => {
  it('accepts positive integers with surrounding whitespace', () => {
    expect(parsePositiveInt('1', '--limit')).toBe(1);
    expect(parsePositiveInt('200', '--limit')).toBe(200);
    expect(parsePositiveInt(' 42 ', '--limit')).toBe(42);
  });

  it('rejects trailing or leading garbage', () => {
    expect(() => parsePositiveInt('12abc', '--limit')).toThrow(
      '--limit expects a positive integer.',
    );
    expect(() => parsePositiveInt('1.5', '--limit')).toThrow(
      '--limit expects a positive integer.',
    );
    expect(() => parsePositiveInt('0x10', '--limit')).toThrow(
      '--limit expects a positive integer.',
    );
    expect(() => parsePositiveInt('-3', '--limit')).toThrow(
      '--limit expects a positive integer.',
    );
  });

  it('rejects zero, leading zeros, and empty values', () => {
    expect(() => parsePositiveInt('0', '--limit')).toThrow(
      '--limit expects a positive integer.',
    );
    expect(() => parsePositiveInt('007', '--limit')).toThrow(
      '--limit expects a positive integer.',
    );
    expect(() => parsePositiveInt('', '--limit')).toThrow(
      '--limit expects a positive integer.',
    );
    expect(() => parsePositiveInt(undefined, '--limit')).toThrow(
      '--limit expects a positive integer.',
    );
  });

  it('rejects integers outside the safe range', () => {
    expect(() => parsePositiveInt('9007199254740992', '--limit')).toThrow(
      '--limit expects a positive integer.',
    );
  });

  it('uses the provided flag name in the error', () => {
    expect(() => parsePositiveInt('nope', '--count')).toThrow(
      '--count expects a positive integer.',
    );
  });
});
