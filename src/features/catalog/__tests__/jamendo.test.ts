import { CatalogTrackSchema } from '@/types/catalog-manifest';

import { dedupeTracksBySlug, licenseNameFromUrl, mapJamendoTrack, slugify } from '../jamendo';

const jamendoTrack = {
  id: '123456',
  name: 'Night Drive',
  duration: 214,
  artist_name: 'Maya Vale',
  album_name: 'After Hours',
  album_image: 'https://usercontent.jamendo.com/album/1/600.jpg',
  image: 'https://usercontent.jamendo.com/album/1/300.jpg',
  audio: 'https://prod-1.storage.jamendo.com/?trackid=123456&format=mp32&from=token',
  license_ccurl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
  musicinfo: {
    tags: {
      genres: ['electronic', 'ambient'],
      vartags: ['instrumental'],
    },
  },
};

describe('licenseNameFromUrl', () => {
  it('derives a readable Creative Commons name from the license URL', () => {
    expect(licenseNameFromUrl('https://creativecommons.org/licenses/by-nc-sa/3.0/')).toBe(
      'CC BY-NC-SA 3.0',
    );
    expect(licenseNameFromUrl('https://creativecommons.org/licenses/by/4.0/')).toBe('CC BY 4.0');
    expect(licenseNameFromUrl('https://creativecommons.org/publicdomain/zero/1.0/')).toBe(
      'CC0 1.0',
    );
  });

  it('returns null for missing or unrecognized license URLs', () => {
    expect(licenseNameFromUrl('')).toBeNull();
    expect(licenseNameFromUrl('not-a-url')).toBeNull();
    expect(licenseNameFromUrl('https://example.com/license')).toBeNull();
  });
});

describe('mapJamendoTrack', () => {
  it('maps a complete record preserving license, license URL, and attribution', () => {
    const track = mapJamendoTrack(jamendoTrack);

    expect(track).toEqual({
      slug: 'maya-vale-night-drive',
      title: 'Night Drive',
      artist: 'Maya Vale',
      album: 'After Hours',
      genre: 'electronic',
      mood: 'instrumental',
      durationMs: 214000,
      audioUrl: jamendoTrack.audio,
      artworkUrl: jamendoTrack.album_image,
      license: 'CC BY-NC-SA 3.0',
      licenseUrl: jamendoTrack.license_ccurl,
      attribution: 'Maya Vale — CC BY-NC-SA 3.0',
    });
    expect(CatalogTrackSchema.safeParse(track).success).toBe(true);
  });

  it('applies schema-safe defaults when optional Jamendo fields are blank', () => {
    const track = mapJamendoTrack({
      ...jamendoTrack,
      album_name: '   ',
      album_image: '',
      musicinfo: { tags: {} },
    });

    expect(track).toMatchObject({
      album: 'Single',
      genre: 'mixed',
      mood: 'mellow',
      artworkUrl: jamendoTrack.image,
    });
    expect(CatalogTrackSchema.safeParse(track).success).toBe(true);
  });

  it('slugifies deterministically and ignores surrounding punctuation and diacritics', () => {
    const first = mapJamendoTrack({
      ...jamendoTrack,
      artist_name: '  Amélie   O’Hara ',
      name: 'Night—Drive!!!',
    });
    const second = mapJamendoTrack({
      ...jamendoTrack,
      artist_name: 'Amélie O’Hara',
      name: 'Night—Drive',
    });

    expect(first?.slug).toBe('amelie-ohara-night-drive');
    expect(second?.slug).toBe(first?.slug);
    expect(slugify('Night—Drive!!!')).toBe('night-drive');
    expect(slugify('  ')).toBe('');
  });

  it.each<[string, unknown]>([
    ['a non-object record', null],
    ['a record missing a title', { ...jamendoTrack, name: '   ' }],
    ['a record missing an artist', { ...jamendoTrack, artist_name: '' }],
    ['a record missing an audio URL', { ...jamendoTrack, audio: '' }],
    ['a record with a non-HTTP audio URL', { ...jamendoTrack, audio: 'not-a-url' }],
    ['a record with zero duration', { ...jamendoTrack, duration: 0 }],
    ['a record with negative duration', { ...jamendoTrack, duration: -12 }],
    ['a record with a non-numeric duration', { ...jamendoTrack, duration: '214' }],
    ['a record missing artwork', { ...jamendoTrack, album_image: '', image: '' }],
    ['a record missing a license URL', { ...jamendoTrack, license_ccurl: '' }],
    [
      'a record with an unrecognized license URL',
      { ...jamendoTrack, license_ccurl: 'https://example.com/license' },
    ],
  ])('skips %s', (_label, raw) => {
    expect(mapJamendoTrack(raw)).toBeNull();
  });
});

describe('dedupeTracksBySlug', () => {
  it('keeps the first occurrence of each slug and reports duplicates', () => {
    const first = mapJamendoTrack(jamendoTrack);
    const duplicate = mapJamendoTrack({ ...jamendoTrack, id: '999', duration: 300 });
    const other = mapJamendoTrack({ ...jamendoTrack, name: 'Blue Hour' });

    if (!first || !duplicate || !other) {
      throw new Error('Fixture tracks should map successfully.');
    }

    const result = dedupeTracksBySlug([first, duplicate, other]);

    expect(result.tracks).toEqual([first, other]);
    expect(result.duplicates).toBe(1);
  });
});
