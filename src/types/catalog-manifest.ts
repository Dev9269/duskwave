import { z } from 'zod';

export const CatalogTrackSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase hyphenated slug.'),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),
  genre: z.string().min(1),
  mood: z.string().min(1),
  durationMs: z.number().int().positive(),
  audioUrl: z.url(),
  artworkUrl: z.url(),
  license: z.string().min(1),
  licenseUrl: z.url(),
  attribution: z.string().min(1),
  isrc: z.string().min(1).optional(),
});

export const CatalogManifestSchema = z.object({
  version: z.literal(1),
  tracks: z.array(CatalogTrackSchema).min(1),
});

export type CatalogTrack = z.infer<typeof CatalogTrackSchema>;
export type CatalogManifest = z.infer<typeof CatalogManifestSchema>;

export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}
