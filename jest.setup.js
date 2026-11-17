/* global jest */

jest.mock('expo-audio', () => {
  function createStatus(playlist) {
    return {
      id: playlist.id,
      currentIndex: playlist.currentIndex,
      trackCount: playlist.trackCount,
      currentTime: playlist.currentTime,
      duration: playlist.duration,
      playing: playlist.playing,
      isBuffering: playlist.isBuffering,
      isLoaded: playlist.isLoaded,
      playbackRate: 1,
      muted: false,
      volume: 1,
      loop: 'none',
      didJustFinish: false,
    };
  }

  let nextPlaylistId = 1;

  class MockAudioPlaylist {
    constructor(options = {}) {
      this.id = `mock-playlist-${nextPlaylistId}`;
      nextPlaylistId += 1;
      this.options = options;
      this.sources = Array.isArray(options.sources) ? [...options.sources] : [];
      this.currentIndex = 0;
      this.trackCount = this.sources.length;
      this.currentTime = 0;
      this.duration = 0;
      this.playing = false;
      this.isBuffering = false;
      this.isLoaded = false;
      this.lockScreen = null;
      this.destroyed = false;
      this.listeners = new Map();
      this.calls = {
        play: 0,
        pause: 0,
        add: [],
        clear: 0,
        skipTo: [],
        seekTo: [],
        setActiveForLockScreen: [],
        updateLockScreenMetadata: [],
        destroy: 0,
      };
    }

    get currentStatus() {
      return createStatus(this);
    }

    addListener(event, listener) {
      const listeners = this.listeners.get(event) ?? new Set();
      listeners.add(listener);
      this.listeners.set(event, listeners);
      return { remove: () => listeners.delete(listener) };
    }

    emit(event, payload) {
      const listeners = this.listeners.get(event);
      if (!listeners) return;
      for (const listener of [...listeners]) listener(payload);
    }

    __emitStatus(overrides = {}) {
      this.emit('playlistStatusUpdate', { ...createStatus(this), ...overrides });
    }

    __emitTrackChanged(previousIndex, currentIndex) {
      this.emit('trackChanged', { previousIndex, currentIndex });
    }

    play() {
      this.playing = true;
      this.calls.play += 1;
    }

    pause() {
      this.playing = false;
      this.calls.pause += 1;
    }

    next() {
      this.calls.skipTo.push('next');
    }

    previous() {
      this.calls.skipTo.push('previous');
    }

    skipTo(index) {
      this.currentIndex = index;
      this.calls.skipTo.push(index);
    }

    seekTo(seconds) {
      this.currentTime = seconds;
      this.calls.seekTo.push(seconds);
      return Promise.resolve();
    }

    add(source) {
      this.sources.push(source);
      this.trackCount = this.sources.length;
      this.calls.add.push(source);
    }

    insert(source, index) {
      this.sources.splice(index, 0, source);
      this.trackCount = this.sources.length;
    }

    remove(index) {
      this.sources.splice(index, 1);
      this.trackCount = this.sources.length;
    }

    clear() {
      this.sources = [];
      this.trackCount = 0;
      this.currentIndex = 0;
      this.currentTime = 0;
      this.duration = 0;
      this.calls.clear += 1;
    }

    destroy() {
      this.destroyed = true;
      this.calls.destroy += 1;
      this.listeners.clear();
    }

    setActiveForLockScreen(active, metadata, options) {
      this.lockScreen = { active, metadata };
      this.calls.setActiveForLockScreen.push({ active, metadata, options });
    }

    updateLockScreenMetadata(metadata) {
      this.lockScreen = { active: true, metadata };
      this.calls.updateLockScreenMetadata.push(metadata);
    }

    clearLockScreenControls() {
      this.lockScreen = null;
    }
  }

  const mockAudioState = {
    playlists: [],
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    createAudioPlaylist: jest.fn((options) => {
      const playlist = new MockAudioPlaylist(options);
      mockAudioState.playlists.push(playlist);
      return playlist;
    }),
    useAudioPlaylist: jest.fn((options) => mockAudioState.createAudioPlaylist(options)),
    useAudioPlaylistStatus: jest.fn(() =>
      createStatus(mockAudioState.playlists[0] ?? new MockAudioPlaylist()),
    ),
    reset() {
      mockAudioState.playlists = [];
      mockAudioState.setAudioModeAsync.mockClear();
      mockAudioState.createAudioPlaylist.mockClear();
      mockAudioState.useAudioPlaylist.mockClear();
      mockAudioState.useAudioPlaylistStatus.mockClear();
    },
  };

  return {
    __audioMock: mockAudioState,
    MockAudioPlaylist,
    createAudioPlaylist: mockAudioState.createAudioPlaylist,
    setAudioModeAsync: mockAudioState.setAudioModeAsync,
    setIsAudioActiveAsync: jest.fn(() => Promise.resolve()),
    useAudioPlaylist: mockAudioState.useAudioPlaylist,
    useAudioPlaylistStatus: mockAudioState.useAudioPlaylistStatus,
    useAudioPlayer: jest.fn(() => ({
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
    })),
    useAudioPlayerStatus: jest.fn(() => ({
      playing: false,
      currentTime: 0,
      duration: 0,
      isLoaded: false,
    })),
    createAudioPlayer: jest.fn(() => ({
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
      remove: jest.fn(),
    })),
    requestRecordingPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
    getRecordingPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
    requestNotificationPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  };
});
