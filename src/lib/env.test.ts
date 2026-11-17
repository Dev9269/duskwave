import { parseSupabaseEnv } from './env';

describe('parseSupabaseEnv', () => {
  it('marks complete https configuration as configured', () => {
    const env = parseSupabaseEnv({ url: 'https://abc.supabase.co', anonKey: 'anon-key' });
    expect(env.configured).toBe(true);
    expect(env.url).toBe('https://abc.supabase.co');
  });

  it('rejects missing values', () => {
    expect(parseSupabaseEnv({ url: 'https://abc.supabase.co' }).configured).toBe(false);
    expect(parseSupabaseEnv({ anonKey: 'key' }).configured).toBe(false);
    expect(parseSupabaseEnv({ url: '   ', anonKey: 'key' }).configured).toBe(false);
  });

  it('allows loopback http for local development only', () => {
    expect(
      parseSupabaseEnv({ url: 'http://127.0.0.1:54321', anonKey: 'key' }).configured,
    ).toBe(true);
    expect(parseSupabaseEnv({ url: 'http://evil.example.com', anonKey: 'key' }).configured).toBe(
      false,
    );
    expect(parseSupabaseEnv({ url: 'ftp://127.0.0.1', anonKey: 'key' }).configured).toBe(false);
  });
});
