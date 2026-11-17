import { suggestUsername, validateUsername } from './username';

describe('validateUsername', () => {
  it('accepts lowercase letters, numbers, and underscores', () => {
    expect(validateUsername('night_owl9')).toBeNull();
  });

  it('rejects short, uppercase, or spaced usernames', () => {
    expect(validateUsername('ab')).not.toBeNull();
    expect(validateUsername('NightOwl')).not.toBeNull();
    expect(validateUsername('night owl')).not.toBeNull();
  });
});

describe('suggestUsername', () => {
  it('builds a handle from an email local part', () => {
    expect(suggestUsername('Jaina.Maru@example.com')).toBe('jaina_maru');
  });

  it('falls back to listener for unusable input', () => {
    expect(suggestUsername('@example.com')).toBe('listener');
  });
});
