import {
  createAudioUrlResolver,
  type AudioUrlResolver,
  type AudioUrlResolverDeps,
} from '../audio-source';

const KEY = 'catalog/night-drive.mp3';

type Harness = {
  resolver: AudioUrlResolver;
  invoke: jest.Mock;
  createSignedUrl: jest.Mock;
  advance: (ms: number) => void;
};

function createHarness(overrides: Partial<AudioUrlResolverDeps> = {}): Harness {
  let current = 0;

  const invoke = jest
    .fn()
    .mockResolvedValue({ url: 'https://r2.example/signed-1', expiresIn: 3600 });
  const createSignedUrl = jest.fn().mockResolvedValue('https://storage.example/signed-1');

  const resolver = createAudioUrlResolver({
    invoke,
    createSignedUrl,
    now: () => current,
    ...overrides,
  });

  return {
    resolver,
    invoke,
    createSignedUrl,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

function track(audioKey: string) {
  return { audioKey, audioUrl: null };
}

describe('resolveAudioUrl', () => {
  it('returns HTTP audio keys unchanged without signing', async () => {
    const { resolver, invoke, createSignedUrl } = createHarness();
    const url = 'https://cdn.example.com/audio/night-drive.mp3';

    await expect(resolver(track(url))).resolves.toBe(url);
    expect(invoke).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('rejects malformed HTTP audio keys without signing', async () => {
    const { resolver, invoke, createSignedUrl } = createHarness();

    await expect(resolver(track('https://'))).rejects.toThrow(/invalid/i);
    expect(invoke).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('passes uppercase HTTP schemes through without signing', async () => {
    const { resolver, invoke } = createHarness();
    const url = 'HTTPS://cdn.example.com/audio/night-drive.mp3';

    await expect(resolver(track(url))).resolves.toBe(url);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('signs an object key through r2-sign', async () => {
    const { resolver, invoke, createSignedUrl } = createHarness();

    await expect(resolver(track(KEY))).resolves.toBe('https://r2.example/signed-1');
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(KEY);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('reuses a cached URL until the safety margin expires, then re-signs', async () => {
    const invoke = jest
      .fn()
      .mockResolvedValueOnce({ url: 'https://r2.example/first', expiresIn: 3600 })
      .mockResolvedValueOnce({ url: 'https://r2.example/second', expiresIn: 3600 });
    const { resolver, advance } = createHarness({ invoke });

    await expect(resolver(track(KEY))).resolves.toBe('https://r2.example/first');

    advance(3_540_000 - 1);
    await expect(resolver(track(KEY))).resolves.toBe('https://r2.example/first');
    expect(invoke).toHaveBeenCalledTimes(1);

    advance(1);
    await expect(resolver(track(KEY))).resolves.toBe('https://r2.example/second');
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('keeps caches separate per audio key', async () => {
    const invoke = jest
      .fn()
      .mockResolvedValueOnce({ url: 'https://r2.example/a', expiresIn: 3600 })
      .mockResolvedValueOnce({ url: 'https://r2.example/b', expiresIn: 3600 });
    const { resolver } = createHarness({ invoke });

    await expect(resolver(track('catalog/a.mp3'))).resolves.toBe('https://r2.example/a');
    await expect(resolver(track('catalog/b.mp3'))).resolves.toBe('https://r2.example/b');
    await expect(resolver(track('catalog/a.mp3'))).resolves.toBe('https://r2.example/a');
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('does not cache a non-positive expiry window', async () => {
    const invoke = jest.fn().mockResolvedValue({ url: 'https://r2.example/short', expiresIn: 60 });
    const { resolver, advance } = createHarness({ invoke });

    await expect(resolver(track(KEY))).resolves.toBe('https://r2.example/short');
    advance(1);
    await expect(resolver(track(KEY))).resolves.toBe('https://r2.example/short');
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight signing request per key', async () => {
    let resolveInvoke!: (value: { url: string; expiresIn: number }) => void;
    const invoke = jest.fn().mockImplementation(
      () =>
        new Promise<{ url: string; expiresIn: number }>((resolve) => {
          resolveInvoke = resolve;
        }),
    );
    const { resolver } = createHarness({ invoke });

    const first = resolver(track(KEY));
    const second = resolver(track(KEY));

    expect(invoke).toHaveBeenCalledTimes(1);
    resolveInvoke({ url: 'https://r2.example/shared', expiresIn: 3600 });

    await expect(first).resolves.toBe('https://r2.example/shared');
    await expect(second).resolves.toBe('https://r2.example/shared');
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('falls back to storage signing when r2-sign fails', async () => {
    const invoke = jest.fn().mockRejectedValue(new Error('r2 unavailable'));
    const createSignedUrl = jest.fn().mockResolvedValue('https://storage.example/signed-fallback');
    const { resolver } = createHarness({ invoke, createSignedUrl });

    await expect(resolver(track(KEY))).resolves.toBe('https://storage.example/signed-fallback');
    expect(invoke).toHaveBeenCalledWith(KEY);
    expect(createSignedUrl).toHaveBeenCalledWith(KEY, 3600);

    await expect(resolver(track(KEY))).resolves.toBe('https://storage.example/signed-fallback');
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('rejects with a clear message when both signing paths fail', async () => {
    const invoke = jest.fn().mockRejectedValue(new Error('r2 unavailable'));
    const createSignedUrl = jest.fn().mockRejectedValue(new Error('storage denied'));
    const { resolver } = createHarness({ invoke, createSignedUrl });

    await expect(resolver(track(KEY))).rejects.toThrow(
      /Could not sign audio for "catalog\/night-drive\.mp3".*storage denied/,
    );
  });

  it('retries after a failed resolution instead of caching the failure', async () => {
    const invoke = jest
      .fn()
      .mockRejectedValueOnce(new Error('r2 unavailable'))
      .mockResolvedValueOnce({ url: 'https://r2.example/recovered', expiresIn: 3600 });
    const createSignedUrl = jest
      .fn()
      .mockRejectedValueOnce(new Error('storage denied'))
      .mockResolvedValueOnce('https://storage.example/recovered');
    const { resolver } = createHarness({ invoke, createSignedUrl });

    await expect(resolver(track(KEY))).rejects.toThrow(/Could not sign audio/);
    await expect(resolver(track(KEY))).resolves.toBe('https://r2.example/recovered');
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('rejects empty audio keys', async () => {
    const { resolver, invoke } = createHarness();

    await expect(resolver(track('   '))).rejects.toThrow(/missing an audio key/i);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('rejects audio keys containing parent segments', async () => {
    const { resolver, invoke } = createHarness();

    await expect(resolver(track('catalog/../secret.mp3'))).rejects.toThrow(/invalid audio key/i);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('rejects absolute non-HTTP keys without signing', async () => {
    const { resolver, invoke } = createHarness();

    await expect(resolver(track('ftp://example.com/night-drive.mp3'))).rejects.toThrow(
      /invalid audio key/i,
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it('evicts the least recently used URL when the cache is full', async () => {
    const invoke = jest
      .fn()
      .mockImplementation((key: string) =>
        Promise.resolve({ url: `https://r2.example/${key}`, expiresIn: 3600 }),
      );
    const { resolver } = createHarness({ invoke, maxCacheEntries: 2 });

    await resolver(track('catalog/a.mp3'));
    await resolver(track('catalog/b.mp3'));
    await resolver(track('catalog/a.mp3'));
    await resolver(track('catalog/c.mp3'));

    await expect(resolver(track('catalog/a.mp3'))).resolves.toBe('https://r2.example/catalog/a.mp3');
    expect(invoke).toHaveBeenCalledTimes(3);

    await resolver(track('catalog/b.mp3'));
    expect(invoke).toHaveBeenCalledTimes(4);
  });

  it('keeps at least one cached entry when the configured limit is not positive', async () => {
    const invoke = jest
      .fn()
      .mockImplementation((key: string) =>
        Promise.resolve({ url: `https://r2.example/${key}`, expiresIn: 3600 }),
      );
    const { resolver } = createHarness({ invoke, maxCacheEntries: 0 });

    await resolver(track('catalog/a.mp3'));
    await resolver(track('catalog/b.mp3'));
    await resolver(track('catalog/a.mp3'));

    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it('clears the cache when reset', async () => {
    const invoke = jest
      .fn()
      .mockResolvedValueOnce({ url: 'https://r2.example/first', expiresIn: 3600 })
      .mockResolvedValueOnce({ url: 'https://r2.example/second', expiresIn: 3600 });
    const { resolver } = createHarness({ invoke });

    await expect(resolver(track(KEY))).resolves.toBe('https://r2.example/first');
    resolver.reset();
    await expect(resolver(track(KEY))).resolves.toBe('https://r2.example/second');
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
