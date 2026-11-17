import { formatCount, formatDuration, formatMinutes } from './format';

describe('formatDuration', () => {
  it('formats milliseconds as m:ss', () => {
    expect(formatDuration(245000)).toBe('4:05');
    expect(formatDuration(9000)).toBe('0:09');
    expect(formatDuration(0)).toBe('0:00');
  });

  it('clamps invalid input', () => {
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('formatCount', () => {
  it('formats thousands and millions', () => {
    expect(formatCount(1234)).toBe('1.2K');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(20000)).toBe('20K');
    expect(formatCount(2_400_000)).toBe('2.4M');
  });
});

describe('formatMinutes', () => {
  it('formats hours and minutes', () => {
    expect(formatMinutes(42)).toBe('42 min');
    expect(formatMinutes(60)).toBe('1 hr');
    expect(formatMinutes(135)).toBe('2 hr 15 min');
  });
});
