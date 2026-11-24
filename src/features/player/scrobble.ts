import type { Track } from '@/features/catalog/api';

export type PlayContext = 'album' | 'playlist' | 'search' | 'blend' | 'jam' | 'liked' | 'history';

type TrackLike = Pick<Track, 'id' | 'durationMs' | 'source'>;

export function isScrobbleableTrack(track: Pick<Track, 'source'>): boolean {
  return track.source !== 'audius';
}

type ScrobbleRecord = {
  localId: string;
  userId: string;
  trackId: string;
  contextType: PlayContext;
  startedAt: string;
  durationMs: number;
  msPlayed: number;
  completed: boolean;
  endedAt: string | null;
  rowId?: number;
  pendingInsert: boolean;
  pendingUpdate: boolean;
};

const STORAGE_KEY = 'duskwave:scrobbles:v1';
const PROGRESS_THROTTLE_MS = 10_000;

let active: ScrobbleRecord | null = null;
let lastReportedMs = 0;
let queue: ScrobbleRecord[] = [];
let queueLoaded = false;
let flushPromise: Promise<void> | null = null;
let appStateSub: { remove: () => void } | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function clampMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function isCompleted(msPlayed: number, durationMs: number): boolean {
  const played = clampMs(msPlayed);
  if (played >= 30_000) return true;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return false;
  return played >= durationMs * 0.5;
}

async function getAsyncStorage() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage');
    return (mod.default ?? mod) as typeof import('@react-native-async-storage/async-storage').default;
  } catch {
    const mod = await import('@react-native-async-storage/async-storage');
    return (mod.default ?? mod) as typeof import('@react-native-async-storage/async-storage').default;
  }
}

function ensureAppStateListener(): void {
  if (appStateSub) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppState } = require('react-native') as typeof import('react-native');
    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        void onAppBackground();
      }
    });
  } catch {
    // ignore
  }
}

async function loadQueue(): Promise<void> {
  if (queueLoaded) return;
  queueLoaded = true;
  try {
    const AsyncStorage = await getAsyncStorage();
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as ScrobbleRecord[];
    if (Array.isArray(parsed)) queue = parsed;
  } catch {
    queue = [];
  }
}

async function persistQueue(): Promise<void> {
  try {
    const AsyncStorage = await getAsyncStorage();
    if (queue.length === 0) await AsyncStorage.removeItem(STORAGE_KEY);
    else await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // never block playback
  }
}

function upsertQueueRecord(record: ScrobbleRecord): void {
  const snapshot = { ...record };
  const index = queue.findIndex((item) => item.localId === record.localId);
  if (index >= 0) queue[index] = snapshot;
  else queue.push(snapshot);
}

function removeQueueRecord(localId: string): void {
  queue = queue.filter((item) => item.localId !== localId);
}

async function getAuthenticatedClient(): Promise<{ client: any; userId: string } | null> {
  try {
    let mod: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('@/lib/supabase');
    } catch {
      mod = await import('@/lib/supabase');
    }
    const client = mod.getSupabase();
    const { data } = await client.auth.getSession();
    const userId = data?.session?.user?.id;
    if (!userId) return null;
    return { client, userId };
  } catch {
    return null;
  }
}

async function tryInsert(record: ScrobbleRecord, client: any): Promise<boolean> {
  try {
    const { data, error } = await client
      .from('plays')
      .insert({
        user_id: record.userId,
        track_id: record.trackId,
        context_type: record.contextType,
        started_at: record.startedAt,
        ended_at: record.endedAt,
        ms_played: record.msPlayed,
        completed: record.completed,
      })
      .select('id')
      .single();
    if (error || !data) return false;
    record.rowId = typeof data.id === 'number' ? data.id : Number(data.id);
    record.pendingInsert = false;
    return true;
  } catch {
    return false;
  }
}

async function tryUpdate(record: ScrobbleRecord, client: any): Promise<boolean> {
  if (record.rowId == null) return false;
  try {
    const { error } = await client
      .from('plays')
      .update({
        ms_played: record.msPlayed,
        completed: record.completed,
        ended_at: record.endedAt,
      })
      .eq('id', record.rowId);
    if (error) return false;
    record.pendingUpdate = false;
    return true;
  } catch {
    return false;
  }
}

async function syncRecord(record: ScrobbleRecord): Promise<void> {
  await loadQueue();
  const auth = await getAuthenticatedClient();
  if (!auth || auth.userId !== record.userId) {
    if (record.pendingInsert || record.pendingUpdate) upsertQueueRecord(record);
    await persistQueue();
    return;
  }

  if (record.pendingInsert && record.rowId == null) {
    const inserted = await tryInsert(record, auth.client);
    if (!inserted) record.pendingInsert = true;
  }

  if (record.rowId != null && record.pendingUpdate) {
    const updated = await tryUpdate(record, auth.client);
    if (!updated) record.pendingUpdate = true;
  }

  if (!record.pendingInsert && !record.pendingUpdate) removeQueueRecord(record.localId);
  else upsertQueueRecord(record);
  await persistQueue();
}

export async function startScrobble(track: TrackLike, context: PlayContext): Promise<void> {
  try {
    ensureAppStateListener();
    await loadQueue();
    await finalizeActive();

    if (!isScrobbleableTrack(track)) {
      active = null;
      lastReportedMs = 0;
      return;
    }

    const auth = await getAuthenticatedClient();
    if (!auth) {
      active = null;
      lastReportedMs = 0;
      return;
    }

    const record: ScrobbleRecord = {
      localId: `${auth.userId}:${track.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      userId: auth.userId,
      trackId: track.id,
      contextType: context,
      startedAt: nowIso(),
      durationMs: Math.max(0, Math.round(track.durationMs || 0)),
      msPlayed: 0,
      completed: false,
      endedAt: null,
      pendingInsert: true,
      pendingUpdate: false,
    };

    active = record;
    lastReportedMs = 0;
    await syncRecord(record);
  } catch {
    active = null;
    lastReportedMs = 0;
  }
}

async function finalizeActive(): Promise<void> {
  if (!active) return;
  const record = active;
  active = null;
  lastReportedMs = 0;
  await syncRecord(record);
}

async function updateActive(msPlayed: number, force: boolean, ended: boolean): Promise<void> {
  if (!active) return;
  try {
    const nextMs = clampMs(msPlayed);
    if (!force && nextMs - lastReportedMs < PROGRESS_THROTTLE_MS) return;

    active.msPlayed = Math.max(active.msPlayed, nextMs);
    active.completed = isCompleted(active.msPlayed, active.durationMs);
    if (ended) active.endedAt = active.endedAt ?? nowIso();
    active.pendingUpdate = true;
    lastReportedMs = active.msPlayed;
    await syncRecord(active);
  } catch {
    // never block playback
  }
}

function syncDuration(durationMs?: number): void {
  if (!active) return;
  if (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0) {
    active.durationMs = Math.round(durationMs);
  }
}

export async function onPlaybackProgress(msPlayed: number, durationMs?: number): Promise<void> {
  syncDuration(durationMs);
  await updateActive(msPlayed, false, false);
}

export async function onPause(msPlayed: number, durationMs?: number): Promise<void> {
  syncDuration(durationMs);
  await updateActive(msPlayed, true, false);
}

export async function onTrackFinished(msPlayed: number, durationMs?: number): Promise<void> {
  syncDuration(durationMs);
  await updateActive(msPlayed, true, true);
  await finalizeActive();
}

export async function onTrackChange(msPlayed: number, durationMs?: number): Promise<void> {
  await onTrackFinished(msPlayed, durationMs);
}

export async function onAppBackground(): Promise<void> {
  if (!active) return;
  await updateActive(active.msPlayed, true, false);
}

export async function flushPendingScrobbles(): Promise<void> {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    try {
      await loadQueue();
      const auth = await getAuthenticatedClient();
      if (!auth) return;

      const remaining: ScrobbleRecord[] = [];
      for (const record of queue) {
        if (record.userId !== auth.userId) {
          remaining.push(record);
          continue;
        }
        const current = { ...record };
        if (!current.rowId) await tryInsert(current, auth.client);
        if (current.rowId != null && current.pendingUpdate) await tryUpdate(current, auth.client);
        if (current.pendingInsert || current.pendingUpdate) remaining.push(current);
      }
      queue = remaining;
      await persistQueue();
    } catch {
      // never block playback
    } finally {
      flushPromise = null;
    }
  })();
  return flushPromise;
}

export async function __resetScrobbleStateForTests(): Promise<void> {
  active = null;
  lastReportedMs = 0;
  queue = [];
  queueLoaded = false;
  flushPromise = null;
  if (appStateSub) {
    try {
      appStateSub.remove();
    } catch {
      // ignore
    }
  }
  appStateSub = null;
}
