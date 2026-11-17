import { createSpotifyAuthUrl } from '../spotify-auth';

describe('createSpotifyAuthUrl', () => {
  it('targets the exact custom-scheme redirect with PKCE', () => {
    const url = createSpotifyAuthUrl({
      clientId: 'client123',
      state: 'state456',
      codeChallenge: 'challenge789',
    });

    expect(url.startsWith('https://accounts.spotify.com/authorize?')).toBe(true);
    expect(url).toContain('redirect_uri=duskwave%3A%2F%2Fredirect');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('code_challenge=challenge789');
    expect(url).toContain('response_type=code');
    expect(url).toContain('state=state456');
  });

  it('requests only the playlist read scopes', () => {
    const url = createSpotifyAuthUrl({
      clientId: 'client123',
      state: 'state456',
      codeChallenge: 'challenge789',
    });

    expect(url).toContain('playlist-read-private');
    expect(url).toContain('playlist-read-collaborative');
    expect(url).not.toContain('user-library-read');
    expect(url).not.toContain('streaming');
  });
});
