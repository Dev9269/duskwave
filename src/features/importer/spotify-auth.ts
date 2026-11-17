export const SPOTIFY_REDIRECT_URI = 'duskwave://redirect';

export const SPOTIFY_SCOPES = ['playlist-read-private', 'playlist-read-collaborative'] as const;

export type SpotifyAuthUrlOptions = {
  clientId: string;
  state: string;
  codeChallenge: string;
};

export function createSpotifyAuthUrl({
  clientId,
  state,
  codeChallenge,
}: SpotifyAuthUrlOptions): string {
  const query = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state,
    scope: SPOTIFY_SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  return `https://accounts.spotify.com/authorize?${query.toString()}`;
}
