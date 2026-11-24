# Audius Second Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge Audius search results into Duskwave Search without changing the database schema, and prevent Audius playback from creating scrobble rows.

**Architecture:** A keyless Audius adapter maps streamable tracks into the existing client `Track` shape. Search runs local and Audius queries independently, merges only enabled-query results with local-wins dedupe, and renders one queue with source badges. Playback reuses the existing HTTP audio resolver; the scrobble layer rejects `source === 'audius'`.

**Tech Stack:** React Native 0.88.1, Expo 58, React Query 5, TypeScript 6, Jest 30, `expo-audio`.

**Spec:** `docs/superpowers/specs/2026-11-19-audius-second-source-design.md`

## Global Constraints

- Do not commit, push, or create a PR until the user explicitly approves.
- Keep the database `TrackSource` enum unchanged; widen only the client `Track.source` type.
- No Audius API key or secret in v1.
- Never send disabled-query cached data into the merge, including source `All`.
- Keep existing auth/Supabase gate; Audius does not bypass sign-in.
- Use Windows PowerShell commands; use `npm.cmd` and `npx.cmd`.
- Use the existing Duskwave tokens/typography and existing UI primitives.
- Run tests with `npm.cmd test -- --runInBand <path>`; typecheck with `npm.cmd run typecheck`; lint with `npm.cmd run lint`.

---

### Task 1: Client source type, Audius config, and adapter

**Files:**
- Modify: `src/types/database.ts` only if the client type needs re-export; do not change the enum.
- Modify: `src/features/catalog/api.ts:4-31`
- Create: `src/features/catalog/audius.ts`
- Modify: `src/lib/env.ts`
- Modify: `.env.example`
- Test: `src/features/catalog/__tests__/audius.test.ts`

**Interfaces:**
- Produces: `AUDIUS_SEARCH_LIMIT = 20`, `AUDIUS_MIN_QUERY_LENGTH = 2`, `AUDIUS_TIMEOUT_MS = 8000`.
- Produces: `buildAudiusStreamUrl(rawId: string): string`.
- Produces: `mapAudiusTrack(raw: AudiusTrack): Track | null`.
- Produces: `mergeSearchResults(local: Track[], audius: Track[]): Track[]`.
- Produces: `searchAudiusTracks(query: string): Promise<Track[]>`.
- Produces: `audiusEnv: { apiBaseUrl: string; appName: string }`.

- [ ] **Step 1: Write the failing adapter tests**

Create `src/features/catalog/__tests__/audius.test.ts`:

```ts
/* eslint-disable import/first */
jest.mock('@/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getSupabase: () => {
    throw new Error('Supabase is not configured for this test.');
  },
}));

import {
  AUDIUS_MIN_QUERY_LENGTH,
  buildAudiusStreamUrl,
  mapAudiusTrack,
  mergeSearchResults,
  searchAudiusTracks,
  type AudiusTrack,
} from '@/features/catalog/audius';
import type { Track } from '@/features/catalog/api';

function rawTrack(overrides: Partial<AudiusTrack> = {}): AudiusTrack {
  return {
    id: 'YmJWK',
    title: 'Golden Hour',
    duration: 180.5,
    is_streamable: true,
    is_stream_gated: false,
    is_available: true,
    is_delete: false,
    access: { stream: true },
    artwork: { '150x150': 'https://img/art-150.jpg' },
    user: {
      name: 'Audius Artist',
      handle: 'audius-artist',
      profile_picture: { '150x150': 'https://img/profile-150.jpg' },
    },
    genre: '  ',
    mood: 'chill',
    bpm: 120,
    isrc: 'US1234567890',
    release_date: '2024-01-01',
    ...overrides,
  };
}

function localTrack(id = 'local-1', title = 'Golden Hour', artist = 'Audius Artist'): Track {
  return {
    id,
    slug: id,
    title,
    artist,
    album: null,
    genre: null,
    mood: null,
    bpm: null,
    durationMs: 180_000,
    coverUrl: null,
    license: 'CC BY',
    licenseUrl: null,
    attribution: null,
    source: 'catalog',
    isPlayable: true,
    audioUrl: null,
    audioKey: `catalog/${id}.mp3`,
    isrc: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  fetchMock.mockReset();
});

describe('Audius mapping', () => {
  it('maps a streamable track into the Duskwave Track shape', () => {
    const track = mapAudiusTrack(rawTrack());

    expect(track).toMatchObject({
      id: 'audius:YmJWK',
      slug: 'audius-YmJWK',
      title: 'Golden Hour',
      artist: 'Audius Artist',
      album: null,
      genre: null,
      mood: 'chill',
      bpm: 120,
      durationMs: 180_500,
      coverUrl: 'https://img/art-150.jpg',
      license: null,
      licenseUrl: null,
      attribution: 'Streamed via Audius',
      source: 'audius',
      isPlayable: true,
      isrc: 'US1234567890',
      createdAt: '2024-01-01',
    });
    expect(track?.audioUrl).toBe(buildAudiusStreamUrl('YmJWK'));
    expect(track?.audioKey).toBe(buildAudiusStreamUrl('YmJWK'));
  });

  it('rejects tracks that cannot be streamed', () => {
    expect(mapAudiusTrack(rawTrack({ is_streamable: false }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ access: { stream: false } }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ is_stream_gated: true }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ is_available: false }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ is_delete: true }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ duration: 0 }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ title: '   ' }))).toBeNull();
  });

  it('uses safe fallbacks for incomplete records', () => {
    const track = mapAudiusTrack(
      rawTrack({
        artwork: undefined,
        user: { profile_picture: 'https://img/profile.jpg' },
        release_date: ' ',
        created_at: ' ',
        genre: ' ',
        bpm: Number.NaN,
      }),
    );

    expect(track?.artist).toBe('Unknown artist');
    expect(track?.coverUrl).toBe('https://img/profile.jpg');
    expect(track?.createdAt).toBe(new Date(0).toISOString());
    expect(track?.genre).toBeNull();
    expect(track?.bpm).toBeNull();
  });
});

describe('Audius search', () => {
  it('fetches, filters, and maps playable results', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [rawTrack(), rawTrack({ id: 'blocked', is_streamable: false })],
      }),
    });

    const results = await searchAudiusTracks('  Golden Hour  ');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/tracks/search?'),
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    expect(fetchMock.mock.calls[0][0]).toContain('query=Golden%20Hour');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('audius:YmJWK');
  });

  it('does not request the API below the minimum query length', async () => {
    await expect(searchAudiusTracks('a')).resolves.toEqual([]);
    await expect(searchAudiusTracks('   ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(AUDIUS_MIN_QUERY_LENGTH).toBe(2);
  });

  it('throws a useful error for a non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    await expect(searchAudiusTracks('Golden Hour')).rejects.toThrow(
      'Audius search failed (503).',
    );
  });
});

describe('Audius merge', () => {
  it('keeps local order and drops duplicate Audius tracks', () => {
    const local = [localTrack('local-1', 'Golden  Hour', 'Audius Artist')];
    const audius = [
      localTrack('audius:1', 'golden hour', ' audius artist '),
      localTrack('audius:2', 'Another Song', 'Another Artist'),
      localTrack('audius:3', 'ANOTHER SONG', 'another artist'),
    ];

    expect(mergeSearchResults(local, audius)).toEqual([
      local[0],
      audius[1],
    ]);
  });

  it('does not mutate either input', () => {
    const local = [localTrack()];
    const audius = [localTrack('audius:1', 'Different', 'Different')];
    const localBefore = [...local];
    const audiusBefore = [...audius];

    mergeSearchResults(local, audius);

    expect(local).toEqual(localBefore);
    expect(audius).toEqual(audiusBefore);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm.cmd test -- --runInBand src/features/catalog/__tests__/audius.test.ts`

Expected: FAIL because `../audius` does not exist and `Track.source` does not include `'audius'`.

- [ ] **Step 3: Widen the client `Track.source` type**

In `src/features/catalog/api.ts`, change the import and add the client type:

```ts
import type {
  Database,
  TrackSource as DatabaseTrackSource,
} from '@/types/database';

export type TrackSource = DatabaseTrackSource | 'audius';
```

Change `Track.source` to `source: TrackSource;`.

- [ ] **Step 4: Add Audius env config**

In `src/lib/env.ts` add:

```ts
export type AudiusEnvInput = {
  apiBaseUrl?: string | null;
  appName?: string | null;
};

export type AudiusEnv = {
  apiBaseUrl: string;
  appName: string;
};

function normalizeBaseUrl(value: string | null | undefined): string {
  const fallback = 'https://api.audius.co/v1';
  const trimmed = value?.trim() || fallback;
  return trimmed.replace(/\/+$/, '');
}

export function parseAudiusEnv(input: AudiusEnvInput = {}): AudiusEnv {
  return {
    apiBaseUrl: normalizeBaseUrl(input.apiBaseUrl),
    appName: input.appName?.trim() || 'Duskwave',
  };
}

export const audiusEnv = parseAudiusEnv({
  apiBaseUrl: process.env.EXPO_PUBLIC_AUDIUS_API_URL,
  appName: process.env.EXPO_PUBLIC_AUDIUS_APP_NAME,
});
```

Add to `.env.example` under the app public values:

```dotenv
EXPO_PUBLIC_AUDIUS_API_URL=https://api.audius.co/v1
EXPO_PUBLIC_AUDIUS_APP_NAME=Duskwave
```

- [ ] **Step 5: Implement the adapter**

Create `src/features/catalog/audius.ts`:

```ts
import { audiusEnv } from '@/lib/env';

import { normalizeText, type Track } from './api';

export const AUDIUS_SEARCH_LIMIT = 20;
export const AUDIUS_MIN_QUERY_LENGTH = 2;
export const AUDIUS_TIMEOUT_MS = 8_000;

type AudiusImage = Record<string, string | null | undefined> | null | undefined;

export type AudiusUser = {
  name?: string | null;
  handle?: string | null;
  profile_picture?: AudiusImage | string | null;
};

export type AudiusTrack = {
  id?: string | null;
  title?: string | null;
  user?: AudiusUser | null;
  artwork?: AudiusImage;
  duration?: number | null;
  genre?: string | null;
  mood?: string | null;
  bpm?: number | null;
  isrc?: string | null;
  release_date?: string | null;
  created_at?: string | null;
  is_streamable?: boolean | null;
  is_stream_gated?: boolean | null;
  access?: { stream?: boolean | null } | null;
  is_available?: boolean | null;
  is_delete?: boolean | null;
};

export function buildAudiusStreamUrl(rawId: string): string {
  const base = audiusEnv.apiBaseUrl.replace(/\/+$/, '');
  const id = encodeURIComponent(rawId);
  const appName = encodeURIComponent(audiusEnv.appName);
  return `${base}/tracks/${id}/stream?app_name=${appName}`;
}

function buildAudiusSearchUrl(query: string, limit: number): string {
  const base = audiusEnv.apiBaseUrl.replace(/\/+$/, '');
  return `${base}/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}&app_name=${encodeURIComponent(audiusEnv.appName)}`;
}

function isPlayableAudiusTrack(raw: AudiusTrack): boolean {
  return (
    normalizeText(raw.id) !== null &&
    normalizeText(raw.title) !== null &&
    raw.is_streamable === true &&
    raw.is_stream_gated !== true &&
    raw.access?.stream !== false &&
    raw.is_available !== false &&
    raw.is_delete !== true &&
    typeof raw.duration === 'number' &&
    Number.isFinite(raw.duration) &&
    raw.duration > 0
  );
}

function artworkFor(raw: AudiusTrack): string | null {
  const artwork =
    normalizeText(raw.artwork?.['480x480']) ??
    normalizeText(raw.artwork?.['150x150']);
  if (artwork) return artwork;

  const profilePicture = raw.user?.profile_picture;
  if (typeof profilePicture === 'string') return normalizeText(profilePicture);

  return (
    normalizeText(profilePicture?.['480x480']) ??
    normalizeText(profilePicture?.['150x150'])
  );
}

export function mapAudiusTrack(raw: AudiusTrack): Track | null {
  if (!raw || !isPlayableAudiusTrack(raw)) return null;

  const rawId = normalizeText(raw.id) as string;
  const title = normalizeText(raw.title) as string;
  const duration = raw.duration as number;
  const streamUrl = buildAudiusStreamUrl(rawId);
  const artist =
    normalizeText(raw.user?.name) ??
    normalizeText(raw.user?.handle) ??
    'Unknown artist';
  const bpm =
    typeof raw.bpm === 'number' && Number.isFinite(raw.bpm) ? raw.bpm : null;
  const createdAt =
    normalizeText(raw.release_date) ??
    normalizeText(raw.created_at) ??
    new Date(0).toISOString();

  return {
    id: `audius:${rawId}`,
    slug: `audius-${rawId}`,
    title,
    artist,
    album: null,
    genre: normalizeText(raw.genre),
    mood: normalizeText(raw.mood),
    bpm,
    durationMs: Math.max(0, Math.round(duration * 1000)),
    coverUrl: artworkFor(raw),
    license: null,
    licenseUrl: null,
    attribution: 'Streamed via Audius',
    source: 'audius',
    isPlayable: true,
    audioUrl: streamUrl,
    audioKey: streamUrl,
    isrc: normalizeText(raw.isrc),
    createdAt,
  };
}

function mapAudiusTracks(value: unknown): Track[] {
  if (!Array.isArray(value)) return [];

  const tracks: Track[] = [];
  for (const candidate of value) {
    try {
      const track = mapAudiusTrack(candidate as AudiusTrack);
      if (track) tracks.push(track);
    } catch {
      // One malformed record must not hide the rest of the response.
    }
  }
  return tracks;
}

export async function searchAudiusTracks(query: string): Promise<Track[]> {
  const normalized = normalizeText(query);
  if (!normalized || normalized.length < AUDIUS_MIN_QUERY_LENGTH) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUDIUS_TIMEOUT_MS);

  try {
    const response = await fetch(buildAudiusSearchUrl(normalized, AUDIUS_SEARCH_LIMIT), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Audius search failed (${response.status}).`);
    }

    const payload = (await response.json()) as { data?: unknown };
    return mapAudiusTracks(payload?.data);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Audius search timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function matchKey(track: Pick<Track, 'title' | 'artist'>): string {
  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${normalize(track.title)}\u0000${normalize(track.artist)}`;
}

export function mergeSearchResults(local: Track[], audius: Track[]): Track[] {
  const seen = new Set(local.map(matchKey));
  const merged = [...local];

  for (const track of audius) {
    const key = matchKey(track);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(track);
  }

  return merged;
}
```

- [ ] **Step 6: Run the adapter tests and typecheck**

Run: `npm.cmd test -- --runInBand src/features/catalog/__tests__/audius.test.ts`

Expected: PASS.

Run: `npm.cmd run typecheck`

Expected: PASS. Do not commit.

---

### Task 2: Search hooks and merge-enabled query behavior

**Files:**
- Modify: `src/features/catalog/hooks.ts:26-57`
- Test: `src/features/catalog/__tests__/search-ui.test.ts`

**Interfaces:**
- Consumes: `searchAudiusTracks`, `AUDIUS_MIN_QUERY_LENGTH`.
- Produces: `useAudiusSearch(query: string, options?: { enabled?: boolean })`.
- Produces: `useSearchTracks(params?, options?: { enabled?: boolean })`.

- [ ] **Step 1: Add a failing hook-interface/helper test**

Add to `src/features/catalog/__tests__/search-ui.test.ts`:

```ts
import {
  DEFAULT_SEARCH_SOURCE,
  SEARCH_SOURCES,
  isFilterActive,
} from '@/features/catalog/components/search-ui';

it('defaults to All and detects active filters', () => {
  expect(DEFAULT_SEARCH_SOURCE).toBe('all');
  expect(SEARCH_SOURCES.map((item) => item.id)).toEqual(['all', 'catalog', 'audius']);
  expect(isFilterActive(DEFAULT_SEARCH_FILTERS)).toBe(false);
  expect(isFilterActive({ ...DEFAULT_SEARCH_FILTERS, genre: 'folk' })).toBe(true);
  expect(isFilterActive({ ...DEFAULT_SEARCH_FILTERS, mood: 'chill' })).toBe(true);
  expect(isFilterActive({ ...DEFAULT_SEARCH_FILTERS, bpmRangeId: 'fast' })).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd test -- --runInBand src/features/catalog/__tests__/search-ui.test.ts`

Expected: FAIL because `SEARCH_SOURCES` and `isFilterActive` do not exist.

- [ ] **Step 3: Add the source type and filter helper**

In `src/features/catalog/components/search-ui.ts` add:

```ts
export type SearchSource = 'all' | 'catalog' | 'audius';
export const DEFAULT_SEARCH_SOURCE: SearchSource = 'all';
export const SEARCH_SOURCES: readonly { id: SearchSource; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'catalog', label: 'Duskwave' },
  { id: 'audius', label: 'Audius' },
];

export function isFilterActive(filters: SearchFilterState): boolean {
  return filters.genre !== null || filters.mood !== null || filters.bpmRangeId !== 'any';
}
```

- [ ] **Step 4: Add the Audius hook and enabled options**

In `src/features/catalog/hooks.ts` add the import:

```ts
import {
  AUDIUS_MIN_QUERY_LENGTH,
  searchAudiusTracks,
} from './audius';
```

Add `audiusSearch` to `catalogKeys`:

```ts
audiusSearch: (query: string) => ['search', 'audius', query] as const,
```

Replace `useSearchTracks` with:

```ts
export type SearchHookOptions = { enabled?: boolean };

export function useSearchTracks(
  params: SearchTracksParams = {},
  options: SearchHookOptions = {},
) {
  const normalized = normalizeSearchParams(params);
  const enabled = options.enabled ?? true;
  return useQuery({
    queryKey: catalogKeys.search(normalized),
    queryFn: () => searchTracks(normalized),
    enabled: enabled && hasActiveSearch(normalized),
    staleTime: SEARCH_STALE_TIME,
    gcTime: 5 * 60_000,
  });
}

export function useAudiusSearch(query: string, options: SearchHookOptions = {}) {
  const trimmed = normalizeText(query) ?? '';
  const enabled = (options.enabled ?? true) && trimmed.length >= AUDIUS_MIN_QUERY_LENGTH;
  return useQuery({
    queryKey: catalogKeys.audiusSearch(trimmed),
    queryFn: () => searchAudiusTracks(trimmed),
    enabled,
    staleTime: SEARCH_STALE_TIME,
    gcTime: 5 * 60_000,
  });
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm.cmd test -- --runInBand src/features/catalog/__tests__/search-ui.test.ts src/features/catalog/__tests__/audius.test.ts`

Expected: PASS.

Run: `npm.cmd run typecheck`

Expected: PASS. Do not commit.

---

### Task 3: Source filter, badge, and UI primitives

**Files:**
- Modify: `src/features/catalog/components/search-browse.tsx:1-20`
- Modify: `src/ui/primitives/track-row.tsx`
- Test: `src/features/catalog/__tests__/search-ui.test.ts`

**Interfaces:**
- Consumes: `SearchSource`, `SEARCH_SOURCES`.
- Produces: `SourceFilterChips({ source, onChange })`.
- Produces: `TrackRow` prop `badge?: string`.

- [ ] **Step 1: Add the source chips component**

In `src/features/catalog/components/search-browse.tsx`, update the imports:

```ts
import {
  BROWSE_CATEGORIES,
  SEARCH_BPM_RANGES,
  SEARCH_GENRES,
  SEARCH_MOODS,
  SEARCH_SOURCES,
  selectBpmRange,
  toggleChipValue,
  type BrowseCategory,
  type SearchFilterState,
  type SearchSource,
} from './search-ui';
```

Add before `SearchFilterChips`:

```tsx
export function SourceFilterChips({
  source,
  onChange,
}: {
  source: SearchSource;
  onChange: (source: SearchSource) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
      {SEARCH_SOURCES.map((item) => (
        <Pill
          key={item.id}
          label={item.label}
          selected={source === item.id}
          onPress={() => onChange(item.id)}
        />
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Add the optional badge to TrackRow**

In `src/ui/primitives/track-row.tsx`, add `badge?: string;` to `TrackRowProps`, destructure it, and update the accessibility label and row rendering:

```tsx
badge?: string;

// ...

accessibilityLabel={badge ? `${title} by ${artist}, ${badge}` : `${title} by ${artist}`}

// ...

{badge ? (
  <View style={styles.badge}>
    <Text variant="caption" muted>
      {badge}
    </Text>
  </View>
) : null}
{durationMs ? (
  <Text variant="caption" muted>
    {formatDuration(durationMs)}
  </Text>
) : null}
```

Add the style:

```ts
badge: {
  borderWidth: 1,
  borderColor: colors.hairline,
  borderRadius: radii.pill,
  paddingHorizontal: spacing.sm,
  paddingVertical: 2,
},
```

- [ ] **Step 3: Run tests and typecheck**

Run: `npm.cmd test -- --runInBand src/features/catalog/__tests__/search-ui.test.ts`

Expected: PASS.

Run: `npm.cmd run typecheck`

Expected: PASS. Do not commit.

---

### Task 4: Merge Audius into the Search screen

**Files:**
- Modify: `src/app/(tabs)/search.tsx`
- Test: manual/typed UI verification after implementation.

**Interfaces:**
- Consumes: `useSearchTracks(params, { enabled })`, `useAudiusSearch(query, { enabled })`.
- Consumes: `mergeSearchResults`, `AUDIUS_MIN_QUERY_LENGTH`, `SourceFilterChips`, `isFilterActive`.

- [ ] **Step 1: Replace the Search screen state and queries**

Implement the screen with source state, independent enabled flags, merged results, and source-specific states. The required logic is:

```tsx
const [source, setSource] = useState<SearchSource>(DEFAULT_SEARCH_SOURCE);
const trimmedQuery = normalizeText(debouncedQuery) ?? '';
const disabled = !isSupabaseConfigured || !session;
const localEnabled = !disabled && source !== 'audius';
const audiusEnabled =
  !disabled && source !== 'catalog' && trimmedQuery.length >= AUDIUS_MIN_QUERY_LENGTH;
const localQueryActive = localEnabled && activeSearch;

const search = useSearchTracks(searchParams, { enabled: localEnabled });
const audius = useAudiusSearch(debouncedQuery, { enabled: audiusEnabled });

const localResults = localQueryActive ? (search.data ?? []) : [];
const audiusResults = audiusEnabled ? (audius.data ?? []) : [];
const results = mergeSearchResults(localResults, audiusResults);

const localLoading =
  localQueryActive && (debouncing || search.isLoading || search.isFetching);
const audiusLoading =
  audiusEnabled && (debouncing || audius.isLoading || audius.isFetching);
const isLoading = localLoading || audiusLoading;
const localError = localQueryActive ? search.error : null;
const audiusError = audiusEnabled ? audius.error : null;
const activeSourceCount =
  (localQueryActive ? 1 : 0) + (audiusEnabled ? 1 : 0);

const showLoading = results.length === 0 && isLoading;
const allActiveFailed =
  activeSourceCount > 0 &&
  !isLoading &&
  (localQueryActive ? !!localError : true) &&
  (audiusEnabled ? !!audiusError : true);
const hasPartialError = !!(localError || audiusError) && !allActiveFailed;
const showPreSearch = !intent && source !== 'audius' && !disabled;
const showAudiusPrompt =
  !disabled && source === 'audius' && trimmedQuery.length === 0;
const showAudiusShort =
  !disabled &&
  source === 'audius' &&
  trimmedQuery.length > 0 &&
  trimmedQuery.length < AUDIUS_MIN_QUERY_LENGTH;
const showAllShortCaption =
  !disabled &&
  source === 'all' &&
  trimmedQuery.length > 0 &&
  trimmedQuery.length < AUDIUS_MIN_QUERY_LENGTH;
const showEmpty =
  !disabled &&
  !showPreSearch &&
  !showAudiusPrompt &&
  !showAudiusShort &&
  !showLoading &&
  !allActiveFailed &&
  activeSourceCount > 0 &&
  results.length === 0;
const showResults =
  !disabled &&
  !showPreSearch &&
  !showAudiusPrompt &&
  !showAudiusShort &&
  !showLoading &&
  !allActiveFailed &&
  results.length > 0;

const errorKey = `${source}:${debouncedQuery}`;
const [dismissedErrorKey, setDismissedErrorKey] = useState<string | null>(null);
const showPartialError = hasPartialError && dismissedErrorKey !== errorKey;
const failedSources = [
  localError ? 'Duskwave' : null,
  audiusError ? 'Audius' : null,
].filter((value): value is string => value !== null);

const retry = () => {
  setDismissedErrorKey(null);
  if (localQueryActive) void search.refetch();
  if (audiusEnabled) void audius.refetch();
};
```

- [ ] **Step 2: Render source chips, filter chips, and the filter caption**

Render directly under the search field:

```tsx
<SourceFilterChips source={source} onChange={setSource} />

{!disabled && !showPreSearch && source !== 'audius' ? (
  <SearchFilterChips filters={filters} onChange={setFilters} />
) : null}

{!disabled && source === 'all' && !showPreSearch && isFilterActive(filters) ? (
  <Text variant="caption" muted style={styles.filterCaption}>
    Filters apply to Duskwave results only.
  </Text>
) : null}
```

Add `filterCaption: { paddingHorizontal: spacing.lg }` to the styles.

- [ ] **Step 3: Render source-specific states and results**

Use this render order:

```tsx
{disabled ? (
  <EmptyState
    title="Catalog unavailable"
    body={
      !isSupabaseConfigured
        ? 'Supabase is not configured, so catalog search cannot load.'
        : 'Sign in to search the catalog.'
    }
  />
) : null}

{showAudiusPrompt ? (
  <EmptyState
    title="Search Audius"
    body="Search Audius for a song or artist."
  />
) : null}

{showAudiusShort ? (
  <EmptyState
    title="Keep typing"
    body={`Type at least ${AUDIUS_MIN_QUERY_LENGTH} characters to search Audius.`}
  />
) : null}

{showBrowse ? <BrowseAll onSelect={browseCategory} /> : null}

{showLoading ? (
  <View style={styles.results}>
    <TrackListSkeleton rows={6} />
  </View>
) : null}

{allActiveFailed ? (
  <EmptyState
    title="Search failed"
    body="Please try again in a moment."
    action={<Button label="Retry" onPress={retry} />}
  />
) : null}

{showPartialError ? (
  <View style={styles.notice}>
    <Text variant="caption" muted style={styles.noticeText}>
      {failedSources.join(' and ')} search failed. Showing available results.
    </Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Dismiss search error"
      onPress={() => setDismissedErrorKey(errorKey)}
    >
      <Text variant="caption" style={styles.noticeAction}>
        Dismiss
      </Text>
    </Pressable>
  </View>
) : null}

{showEmpty ? (
  <EmptyState
    title="No tracks found"
    body={
      source === 'catalog'
        ? 'Try a different query or clear a filter. Only playable Duskwave tracks appear here.'
        : 'Try a different query or source.'
    }
  />
) : null}

{showResults ? (
  <View style={styles.results}>
    <Text variant="caption" muted style={styles.resultCount}>
      {results.length} result{results.length === 1 ? '' : 's'}
    </Text>
    {showAllShortCaption ? (
      <Text variant="caption" muted>
        Type at least {AUDIUS_MIN_QUERY_LENGTH} characters to search Audius.
      </Text>
    ) : null}
    {results.length > 0 && audiusLoading && !localLoading ? (
      <Text variant="caption" muted>Searching Audius…</Text>
    ) : null}
    {results.length > 0 && localLoading && !audiusLoading ? (
      <Text variant="caption" muted>Searching Duskwave…</Text>
    ) : null}
    <View style={styles.trackList}>
      {results.map((track, index) => (
        <TrackRow
          key={track.id}
          title={track.title}
          artist={track.artist}
          artworkUrl={track.coverUrl}
          badge={track.source === 'audius' ? 'Audius' : undefined}
          onPress={() => void playQueue(results, index, 'search')}
        />
      ))}
    </View>
  </View>
) : null}
```

Import `Button` and `Pressable`; define `showBrowse = !disabled && showPreSearch`. Add notice styles:

```ts
notice: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing.sm,
  borderWidth: 1,
  borderColor: colors.hairline,
  borderRadius: radii.md,
  padding: spacing.md,
},
noticeText: { flex: 1 },
noticeAction: { textDecorationLine: 'underline' },
```

- [ ] **Step 4: Verify the screen compiles**

Run: `npm.cmd run typecheck`

Expected: PASS.

Run: `npm.cmd run lint`

Expected: PASS. Do not commit.

---

### Task 5: Scrobble guard

**Files:**
- Modify: `src/features/player/scrobble.ts:1-20,195-206`
- Modify: `src/features/player/engine.ts:14-20,168-172`
- Test: `src/features/player/__tests__/scrobble.test.ts`

**Interfaces:**
- Produces: `isScrobbleableTrack(track: Pick<Track, 'source'>): boolean`.
- `startScrobble` finalizes any active record, then returns for Audius before authentication/insert.

- [ ] **Step 1: Add failing scrobble tests**

Update `makeTrack` to accept a source and add tests:

```ts
function makeTrack(
  id = 'track-1',
  durationMs = 200_000,
  source: Track['source'] = 'catalog',
): Track {
  return {
    // ...existing fields...
    source,
    // ...existing fields...
  };
}

it('marks catalog tracks scrobbleable and Audius tracks not scrobbleable', () => {
  expect(isScrobbleableTrack({ source: 'catalog' })).toBe(true);
  expect(isScrobbleableTrack({ source: 'audius' })).toBe(false);
});

it('finalizes the catalog track but inserts no row for an Audius track', async () => {
  const { client, insert } = createClient();
  getSupabaseMock.mockReturnValue(client as never);

  await startScrobble(makeTrack('catalog-1', 200_000, 'catalog'), 'history');
  await startScrobble(makeTrack('audius:YmJWK', 200_000, 'audius'), 'search');
  await onPlaybackProgress(60_000, 200_000);

  expect(insert).toHaveBeenCalledTimes(1);
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({ track_id: 'catalog-1' }),
  );
  expect(insert).not.toHaveBeenCalledWith(
    expect.objectContaining({ track_id: 'audius:YmJWK' }),
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm.cmd test -- --runInBand src/features/player/__tests__/scrobble.test.ts`

Expected: FAIL because `isScrobbleableTrack` is missing and Audius currently inserts a row.

- [ ] **Step 3: Implement the guard**

In `src/features/player/scrobble.ts`:

```ts
type TrackLike = Pick<Track, 'id' | 'durationMs' | 'source'>;

export function isScrobbleableTrack(track: Pick<Track, 'source'>): boolean {
  return track.source !== 'audius';
}
```

In `startScrobble`, after `await finalizeActive();`:

```ts
if (!isScrobbleableTrack(track)) {
  active = null;
  lastReportedMs = 0;
  return;
}
```

In `src/features/player/engine.ts`, import `isScrobbleableTrack` and guard `beginScrobble`:

```ts
function beginScrobble(track: Track | undefined, index: number): void {
  if (!track || !isScrobbleableTrack(track)) return;
  scrobbleIndex = index;
  void startScrobble(track, loadedContext);
}
```

- [ ] **Step 4: Run the scrobble tests and typecheck**

Run: `npm.cmd test -- --runInBand src/features/player/__tests__/scrobble.test.ts`

Expected: PASS.

Run: `npm.cmd run typecheck`

Expected: PASS. Do not commit.

---

### Task 6: Full verification and smoke checks

**Files:**
- No new files.

- [ ] **Step 1: Run the full test suite**

Run: `npm.cmd test -- --runInBand`

Expected: all suites pass.

- [ ] **Step 2: Run typecheck and lint**

Run: `npm.cmd run typecheck`

Run: `npm.cmd run lint`

Expected: both pass.

- [ ] **Step 3: Verify no schema change**

Run: `git -C C:\dw diff -- src/types/database.ts`

Expected: no changes to the database enum or generated schema.

- [ ] **Step 4: Report results without committing**

Summarize changed files, test output, and the fact that nothing was committed. Do not run `git commit`, `git push`, or create a PR.
