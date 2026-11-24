import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import { mapTrackRows, type Track } from './api';

type Client = SupabaseClient<Database>;

export type AlbumDetail = {
  id: string;
  title: string;
  coverUrl: string | null;
  releaseYear: number | null;
  artistId: string;
  artistName: string;
  tracks: Track[];
};

export type ArtistAlbum = {
  id: string;
  title: string;
  coverUrl: string | null;
  releaseYear: number | null;
};

export type ArtistDetail = {
  id: string;
  name: string;
  imageUrl: string | null;
  bio: string | null;
  albums: ArtistAlbum[];
  tracks: Track[];
};

export type PlaylistDetail = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  tracks: Track[];
};

export type GenreDetail = {
  name: string;
  tracks: Track[];
};

function fail(label: string, message: string): never {
  throw new Error(`Could not load ${label}: ${message}`);
}

export async function getAlbumDetail(client: Client, id: string): Promise<AlbumDetail | null> {
  const { data: album, error } = await client
    .from('albums')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) fail('album', error.message);
  if (!album) return null;

  const { data: artist, error: artistError } = await client
    .from('artists')
    .select('name')
    .eq('id', album.artist_id)
    .maybeSingle();
  if (artistError) fail('album artist', artistError.message);

  const { data: rows, error: tracksError } = await client
    .from('tracks')
    .select('*')
    .eq('album_id', id)
    .eq('is_playable', true)
    .order('created_at', { ascending: false });
  if (tracksError) fail('album tracks', tracksError.message);

  return {
    id: album.id,
    title: album.title,
    coverUrl: album.cover_url,
    releaseYear: album.release_year,
    artistId: album.artist_id,
    artistName: artist?.name ?? 'Unknown artist',
    tracks: await mapTrackRows(client, rows ?? []),
  };
}

export async function getArtistDetail(client: Client, id: string): Promise<ArtistDetail | null> {
  const { data: artist, error } = await client
    .from('artists')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) fail('artist', error.message);
  if (!artist) return null;

  const { data: albumRows, error: albumsError } = await client
    .from('albums')
    .select('*')
    .eq('artist_id', id)
    .order('release_year', { ascending: false });
  if (albumsError) fail('artist albums', albumsError.message);

  const { data: trackRows, error: tracksError } = await client
    .from('tracks')
    .select('*')
    .eq('artist_id', id)
    .eq('is_playable', true)
    .order('created_at', { ascending: false });
  if (tracksError) fail('artist tracks', tracksError.message);

  return {
    id: artist.id,
    name: artist.name,
    imageUrl: artist.image_url,
    bio: artist.bio,
    albums: (albumRows ?? []).map((album) => ({
      id: album.id,
      title: album.title,
      coverUrl: album.cover_url,
      releaseYear: album.release_year,
    })),
    tracks: await mapTrackRows(client, trackRows ?? []),
  };
}

export async function getPlaylistDetail(
  client: Client,
  id: string,
): Promise<PlaylistDetail | null> {
  const { data: playlist, error } = await client
    .from('playlists')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) fail('playlist', error.message);
  if (!playlist) return null;

  const { data: links, error: linksError } = await client
    .from('playlist_tracks')
    .select('*')
    .eq('playlist_id', id);
  if (linksError) fail('playlist tracks', linksError.message);

  const sorted = [...(links ?? [])].sort((a, b) => a.position - b.position);
  const trackIds = sorted.map((link) => link.track_id);
  if (trackIds.length === 0) {
    return {
      id: playlist.id,
      title: playlist.title,
      description: playlist.description,
      coverUrl: playlist.cover_url,
      tracks: [],
    };
  }

  const { data: rows, error: tracksError } = await client
    .from('tracks')
    .select('*')
    .in('id', trackIds);
  if (tracksError) fail('playlist tracks', tracksError.message);

  const byId = new Map((rows ?? []).map((row) => [row.id, row]));
  const orderedRows = trackIds
    .map((trackId) => byId.get(trackId))
    .filter((row): row is NonNullable<typeof row> => row !== undefined);

  return {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description,
    coverUrl: playlist.cover_url,
    tracks: await mapTrackRows(client, orderedRows),
  };
}

export async function getGenreDetail(
  client: Client,
  name: string,
  limit = 20,
): Promise<GenreDetail> {
  const { data, error } = await client
    .from('tracks')
    .select('*')
    .eq('genre', name)
    .eq('is_playable', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) fail(`${name} genre`, error.message);

  return {
    name,
    tracks: (await mapTrackRows(client, data ?? [])).slice(0, limit),
  };
}
