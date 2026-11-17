import { CatalogManifestSchema, formatIssues } from '@/types/catalog-manifest';

const validTrack = {
  slug: 'night-drive',
  title: 'Night Drive',
  artist: 'Example Artist',
  album: 'After Hours',
  genre: 'ambient',
  mood: 'nocturnal',
  durationMs: 214000,
  audioUrl: 'https://example.com/audio/night-drive.mp3',
  artworkUrl: 'https://example.com/art/night-drive.jpg',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'Example Artist — CC BY 4.0',
};

describe('CatalogManifestSchema', () => {
  it('accepts a manifest with complete attribution', () => {
    const result = CatalogManifestSchema.safeParse({
      version: 1,
      tracks: [validTrack],
    });

    expect(result.success).toBe(true);
  });

  it('rejects a track missing attribution', () => {
    const { attribution: _attribution, ...rest } = validTrack;
    const result = CatalogManifestSchema.safeParse({ version: 1, tracks: [rest] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatIssues(result.error)).toContain('tracks.0.attribution');
    }
  });

  it('rejects empty manifests and unknown versions', () => {
    expect(CatalogManifestSchema.safeParse({ version: 1, tracks: [] }).success).toBe(false);
    expect(CatalogManifestSchema.safeParse({ version: 2, tracks: [validTrack] }).success).toBe(
      false,
    );
  });
});
