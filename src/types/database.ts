export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserTier = 'free' | 'premium';
export type PlaylistKind = 'user' | 'liked' | 'blend' | 'import' | 'jam';
export type PlaylistVisibility = 'private' | 'public' | 'unlisted';
export type TrackSource = 'catalog' | 'upload';
export type PlayContext = 'album' | 'playlist' | 'search' | 'blend' | 'jam' | 'liked' | 'history';
export type ImportStatus = 'pending' | 'fetching' | 'matching' | 'done' | 'failed';
export type ImportMatchStatus = 'matched' | 'vibe' | 'placeholder' | 'skipped';
export type JamRole = 'host' | 'guest';

type Timestamp = string;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          tier: UserTier;
          premium_since: Timestamp | null;
          history_enabled: boolean;
          onboarding: Json;
          created_at: Timestamp;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          tier?: UserTier;
          premium_since?: Timestamp | null;
          history_enabled?: boolean;
          onboarding?: Json;
          created_at?: Timestamp;
        };
        Update: {
          username?: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          tier?: UserTier;
          premium_since?: Timestamp | null;
          history_enabled?: boolean;
          onboarding?: Json;
        };
        Relationships: [];
      };
      artists: {
        Row: {
          id: string;
          name: string;
          image_url: string | null;
          bio: string | null;
          license: string | null;
          license_url: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          image_url?: string | null;
          bio?: string | null;
          license?: string | null;
          license_url?: string | null;
        };
        Update: {
          name?: string;
          image_url?: string | null;
          bio?: string | null;
          license?: string | null;
          license_url?: string | null;
        };
        Relationships: [];
      };
      albums: {
        Row: {
          id: string;
          artist_id: string;
          title: string;
          cover_url: string | null;
          release_year: number | null;
          license: string | null;
          license_url: string | null;
        };
        Insert: {
          id?: string;
          artist_id: string;
          title: string;
          cover_url?: string | null;
          release_year?: number | null;
          license?: string | null;
          license_url?: string | null;
        };
        Update: {
          artist_id?: string;
          title?: string;
          cover_url?: string | null;
          release_year?: number | null;
          license?: string | null;
          license_url?: string | null;
        };
        Relationships: [];
      };
      tracks: {
        Row: {
          id: string;
          slug: string;
          title: string;
          artist_id: string;
          album_id: string | null;
          duration_ms: number;
          audio_key: string;
          cover_url: string | null;
          isrc: string | null;
          genre: string | null;
          mood: string | null;
          bpm: number | null;
          source: TrackSource;
          owner_id: string | null;
          is_playable: boolean;
          license: string | null;
          license_url: string | null;
          attribution: string | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          artist_id: string;
          album_id?: string | null;
          duration_ms: number;
          audio_key: string;
          cover_url?: string | null;
          isrc?: string | null;
          genre?: string | null;
          mood?: string | null;
          bpm?: number | null;
          source?: TrackSource;
          owner_id?: string | null;
          is_playable?: boolean;
          license?: string | null;
          license_url?: string | null;
          attribution?: string | null;
          created_at?: Timestamp;
        };
        Update: {
          slug?: string;
          title?: string;
          artist_id?: string;
          album_id?: string | null;
          duration_ms?: number;
          audio_key?: string;
          cover_url?: string | null;
          isrc?: string | null;
          genre?: string | null;
          mood?: string | null;
          bpm?: number | null;
          source?: TrackSource;
          owner_id?: string | null;
          is_playable?: boolean;
          license?: string | null;
          license_url?: string | null;
          attribution?: string | null;
        };
        Relationships: [];
      };
      playlists: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          cover_url: string | null;
          kind: PlaylistKind;
          visibility: PlaylistVisibility;
          pair_key: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          description?: string | null;
          cover_url?: string | null;
          kind?: PlaylistKind;
          visibility?: PlaylistVisibility;
          pair_key?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: {
          title?: string;
          description?: string | null;
          cover_url?: string | null;
          kind?: PlaylistKind;
          visibility?: PlaylistVisibility;
          pair_key?: string | null;
        };
        Relationships: [];
      };
      playlist_tracks: {
        Row: {
          id: string;
          playlist_id: string;
          track_id: string;
          position: number;
          added_by: string;
          added_at: Timestamp;
        };
        Insert: {
          id?: string;
          playlist_id: string;
          track_id: string;
          position: number;
          added_by: string;
          added_at?: Timestamp;
        };
        Update: {
          position?: number;
          track_id?: string;
        };
        Relationships: [];
      };
      likes: {
        Row: { user_id: string; track_id: string; created_at: Timestamp };
        Insert: { user_id: string; track_id: string; created_at?: Timestamp };
        Update: { user_id?: string; track_id?: string };
        Relationships: [];
      };
      plays: {
        Row: {
          id: number;
          user_id: string;
          track_id: string;
          context_type: PlayContext;
          context_id: string | null;
          started_at: Timestamp;
          ended_at: Timestamp | null;
          ms_played: number;
          completed: boolean;
        };
        Insert: {
          id?: number;
          user_id: string;
          track_id: string;
          context_type: PlayContext;
          context_id?: string | null;
          started_at?: Timestamp;
          ended_at?: Timestamp | null;
          ms_played?: number;
          completed?: boolean;
        };
        Update: { ended_at?: Timestamp | null; ms_played?: number; completed?: boolean };
        Relationships: [];
      };
      skip_events: {
        Row: { id: number; user_id: string; created_at: Timestamp };
        Insert: { id?: number; user_id: string; created_at?: Timestamp };
        Update: { user_id?: string; created_at?: Timestamp };
        Relationships: [];
      };
      jam_sessions: {
        Row: {
          id: string;
          host_id: string;
          code: string;
          name: string;
          is_active: boolean;
          current_track_id: string | null;
          position_ms: number;
          is_playing: boolean;
          updated_at: Timestamp;
          created_at: Timestamp;
          ended_at: Timestamp | null;
        };
        Insert: {
          id?: string;
          host_id: string;
          code: string;
          name?: string;
          is_active?: boolean;
          current_track_id?: string | null;
          position_ms?: number;
          is_playing?: boolean;
          created_at?: Timestamp;
          ended_at?: Timestamp | null;
        };
        Update: {
          name?: string;
          is_active?: boolean;
          current_track_id?: string | null;
          position_ms?: number;
          is_playing?: boolean;
          ended_at?: Timestamp | null;
        };
        Relationships: [];
      };
      jam_participants: {
        Row: { session_id: string; user_id: string; role: JamRole; joined_at: Timestamp };
        Insert: { session_id: string; user_id: string; role?: JamRole; joined_at?: Timestamp };
        Update: { role?: JamRole };
        Relationships: [];
      };
      jam_queue: {
        Row: {
          id: string;
          session_id: string;
          track_id: string;
          added_by: string;
          position: number;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          session_id: string;
          track_id: string;
          added_by: string;
          position: number;
          created_at?: Timestamp;
        };
        Update: { position?: number };
        Relationships: [];
      };
      import_jobs: {
        Row: {
          id: string;
          user_id: string;
          source_playlist_id: string;
          source_name: string;
          status: ImportStatus;
          total: number;
          matched: number;
          vibe_matched: number;
          placeholders: number;
          error: string | null;
          created_at: Timestamp;
          finished_at: Timestamp | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_playlist_id: string;
          source_name: string;
          status?: ImportStatus;
          total?: number;
          matched?: number;
          vibe_matched?: number;
          placeholders?: number;
          error?: string | null;
          created_at?: Timestamp;
          finished_at?: Timestamp | null;
        };
        Update: {
          status?: ImportStatus;
          total?: number;
          matched?: number;
          vibe_matched?: number;
          placeholders?: number;
          error?: string | null;
          finished_at?: Timestamp | null;
        };
        Relationships: [];
      };
      import_items: {
        Row: {
          id: string;
          job_id: string;
          source_track_id: string;
          title: string;
          artists: string;
          album: string | null;
          isrc: string | null;
          duration_ms: number | null;
          matched_track_id: string | null;
          confidence: number | null;
          status: ImportMatchStatus;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          job_id: string;
          source_track_id: string;
          title: string;
          artists: string;
          album?: string | null;
          isrc?: string | null;
          duration_ms?: number | null;
          matched_track_id?: string | null;
          confidence?: number | null;
          status: ImportMatchStatus;
          created_at?: Timestamp;
        };
        Update: {
          matched_track_id?: string | null;
          confidence?: number | null;
          status?: ImportMatchStatus;
        };
        Relationships: [];
      };
      blends: {
        Row: {
          id: string;
          pair_key: string;
          user_a: string;
          user_b: string;
          score: number;
          playlist_id: string | null;
          last_generated_at: Timestamp;
        };
        Insert: {
          id?: string;
          pair_key: string;
          user_a: string;
          user_b: string;
          score: number;
          playlist_id?: string | null;
          last_generated_at?: Timestamp;
        };
        Update: {
          score?: number;
          playlist_id?: string | null;
          last_generated_at?: Timestamp;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      seed_demo_history: { Args: Record<string, never>; Returns: number };
      consume_skip: { Args: Record<string, never>; Returns: boolean };
      search_tracks: {
        Args: {
          q?: string | null;
          genre?: string | null;
          mood?: string | null;
          bpm_min?: number | null;
          bpm_max?: number | null;
          lim?: number | null;
          off?: number | null;
        };
        Returns: Database['public']['Tables']['tracks']['Row'][];
      };
    };
    Enums: {
      user_tier: UserTier;
      playlist_kind: PlaylistKind;
      playlist_visibility: PlaylistVisibility;
      track_source: TrackSource;
      play_context: PlayContext;
      import_status: ImportStatus;
      import_match_status: ImportMatchStatus;
      jam_role: JamRole;
    };
    CompositeTypes: Record<string, never>;
  };
}
