import { greeting } from './greeting';

describe('greeting', () => {
  it('greets the small hours differently', () => {
    expect(greeting(new Date(2026, 10, 17, 2, 0))).toBe('Still up');
  });

  it('covers morning, afternoon, and evening', () => {
    expect(greeting(new Date(2026, 10, 17, 9, 0))).toBe('Good morning');
    expect(greeting(new Date(2026, 10, 17, 14, 0))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 10, 17, 21, 0))).toBe('Good evening');
  });
});
