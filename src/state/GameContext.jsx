import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { gameReducer, initialGameState } from './gameReducer.js';
import { useSettings } from './SettingsContext.jsx';
import { StagePlayer } from '../audio/StagePlayer.js';
import { listCustom, loadPlaylistTracks, saveCustom } from '../services/playlists.js';
import { getAllPlaylists } from '../services/catalog.js';
import { isAbortError } from '../utils/errors.js';
import { shuffle } from '../utils/shuffle.js';
import { attachResolvedIds, buildRefill, dedupeTracks } from './gameLoading.js';

const GameContext = createContext(null);

/** Full preview length, played on the reveal. */
const REVEAL_LIMIT = 30;

/**
 * Playback progress lives outside React state so 60fps updates re-render only
 * the components that subscribe (`useGameProgress`), not the whole tree.
 */
function createProgressStore() {
  let value = { t: 0, limit: 0 };
  const listeners = new Set();
  return {
    get: () => value,
    set(t, limit) {
      if (t === value.t && limit === value.limit) return;
      value = { t, limit };
      listeners.forEach((l) => l());
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

/**
 * Wires the reducer to the StagePlayer and the playlist loader.
 *
 * `phase` is the async status around `state.status`:
 * 'idle' (no game) · 'loading' (playlists resolving, or the current song's
 * audio loading) · 'ready' (the song can play) · 'error' (`error` is
 * 'offline' | 'not-enough'). `loadProgress` is `{ done, total }` while
 * playlists resolve, otherwise null.
 */
export function GameProvider({ children }) {
  const [settings] = useSettings();
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState(null);
  const [loadProgress, setLoadProgress] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressStore] = useState(createProgressStore);

  const playerRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const playingRef = useRef(false);
  const poolRef = useRef([]);
  const abortRef = useRef(null);
  const lastSetupRef = useRef(null);
  const prefetchRef = useRef(null);

  const setPlaying = useCallback((v) => {
    playingRef.current = v;
    setIsPlaying(v);
  }, []);

  // One player per provider mount; created in the effect so StrictMode's
  // mount → unmount → mount gets a live player rather than a destroyed one.
  useEffect(() => {
    const p = new StagePlayer();
    playerRef.current = p;
    p.onProgress = (t, limit) => progressStore.set(t, limit);
    p.onEnd = () => setPlaying(false);
    return () => {
      p.destroy();
      if (playerRef.current === p) playerRef.current = null;
    };
  }, [progressStore, setPlaying]);

  useEffect(() => {
    playerRef.current?.setVolume(settings.volume);
  }, [settings.volume]);

  /** Stop playback without aborting a pending load. */
  const halt = useCallback(() => {
    if (!playingRef.current) return;
    playerRef.current?.stop();
    setPlaying(false);
  }, [setPlaying]);

  // Background tabs throttle the backup timer and iOS suspends JS on lock:
  // stop rather than let a stage run past its limit unseen.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') halt();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', halt);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', halt);
    };
  }, [halt]);

  const refillFor = useCallback((s) => {
    if (s.mode !== 'endless' || s.index + 1 < s.queue.length) return undefined;
    return buildRefill(poolRef.current, s.queue, s.index);
  }, []);

  const replaceCurrent = useCallback(() => {
    const s = stateRef.current;
    dispatch({ type: 'REPLACE_CURRENT', refill: s.reserve.length ? undefined : refillFor(s) });
  }, [refillFor]);

  // Load the current song whenever it changes (not on stage changes or the reveal).
  const current = state.status === 'playing' ? state.queue[state.index] : null;
  const trackKey = current ? `${state.index}:${current.id}` : null;
  useEffect(() => {
    if (!current) return undefined;
    const p = playerRef.current;
    if (!p) return undefined;
    let live = true;
    setPlaying(false);
    progressStore.set(0, 0);
    setPhase('loading');
    p.load(current.previewUrl).then(
      () => live && setPhase('ready'),
      (err) => {
        if (!live || isAbortError(err)) return;
        if (err?.message === 'audio-timeout') {
          // Slow networks and iOS often never report readiness: let play() try.
          setPhase('ready');
          return;
        }
        replaceCurrent();
      }
    );
    const next = stateRef.current.queue[stateRef.current.index + 1];
    if (next?.previewUrl && typeof Audio !== 'undefined') {
      const a = new Audio();
      a.preload = 'auto';
      a.src = next.previewUrl;
      prefetchRef.current = a;
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey]);

  const startPlayback = useCallback(
    (limit) => {
      const p = playerRef.current;
      if (!p) return;
      setPlaying(true);
      progressStore.set(0, limit);
      p.play(limit).catch((err) => {
        setPlaying(false);
        if (isAbortError(err) || err?.name === 'NotAllowedError') return;
        // A source that timed out and then refuses to play is gone: swap the song.
        if (stateRef.current.status === 'playing') replaceCurrent();
      });
    },
    [progressStore, replaceCurrent, setPlaying]
  );

  // The reveal plays the full preview (the guess/skip was the user gesture).
  useEffect(() => {
    if (state.status === 'reveal') startPlayback(REVEAL_LIMIT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.index]);

  // Quitting (or unmounting) mid-load cancels the playlist requests.
  useEffect(() => () => abortRef.current?.abort(), []);

  const start = useCallback(
    async ({ mode, playlistIds }) => {
      const p = playerRef.current;
      p?.unlock();
      p?.stop();
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      lastSetupRef.current = { mode, playlistIds };
      setPlaying(false);
      dispatch({ type: 'QUIT' });
      setError(null);
      setPhase('loading');

      const ids = new Set(playlistIds);
      const chosen = getAllPlaylists().filter((pl) => ids.has(pl.id));
      const total = chosen.reduce((n, pl) => n + pl.tracks.length, 0);
      setLoadProgress({ done: 0, total });

      try {
        const found = [];
        let netError = null;
        let base = 0;
        for (const pl of chosen) {
          const res = await loadPlaylistTracks(pl, {
            country: settings.country,
            useCache: true,
            searchMissing: pl.custom,
            signal: ac.signal,
            onProgress: (done) => {
              if (!ac.signal.aborted) setLoadProgress({ done: base + done, total });
            },
          });
          if (ac.signal.aborted) return;
          base += pl.tracks.length;
          found.push(...res.tracks);
          netError ??= res.error;
          if (pl.custom) {
            const raw = listCustom().find((c) => c.id === pl.id);
            const tracks = raw && attachResolvedIds(raw.tracks, res.tracks);
            if (tracks) saveCustom({ ...raw, tracks });
          }
        }
        const pool = shuffle(dedupeTracks(found));
        if (pool.length < settings.minPlayableSongs) {
          setError(netError ? 'offline' : 'not-enough');
          setPhase('error');
          setLoadProgress(null);
          return;
        }
        poolRef.current = pool;
        setLoadProgress(null);
        dispatch({ type: 'START', mode, tracks: pool, settings });
      } catch (err) {
        if (isAbortError(err) || ac.signal.aborted) return;
        setError('offline');
        setPhase('error');
        setLoadProgress(null);
      }
    },
    [settings, setPlaying]
  );

  const retry = useCallback(() => {
    if (lastSetupRef.current) start(lastSetupRef.current);
  }, [start]);

  const play = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    p.unlock();
    if (playingRef.current) {
      halt();
      return;
    }
    const s = stateRef.current;
    if (s.status === 'playing') startPlayback(s.settings.stages[s.stage]);
    else if (s.status === 'reveal') startPlayback(REVEAL_LIMIT);
  }, [halt, startPlayback]);

  const guess = useCallback(
    (text) => {
      playerRef.current?.unlock();
      halt();
      dispatch({ type: 'GUESS', text });
    },
    [halt]
  );

  const skip = useCallback(() => {
    playerRef.current?.unlock();
    halt();
    dispatch({ type: 'SKIP' });
  }, [halt]);

  const buyHint = useCallback((hint) => dispatch({ type: 'BUY_HINT', hint }), []);

  const next = useCallback(() => {
    halt();
    dispatch({ type: 'NEXT', refill: refillFor(stateRef.current) });
  }, [halt, refillFor]);

  const quit = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    playerRef.current?.stop();
    setPlaying(false);
    progressStore.set(0, 0);
    dispatch({ type: 'QUIT' });
    setPhase('idle');
    setError(null);
    setLoadProgress(null);
  }, [progressStore, setPlaying]);

  // A finished game has nothing left to load or play.
  useEffect(() => {
    if (state.status === 'over') setPhase('idle');
  }, [state.status]);

  const value = useMemo(
    () => ({
      state,
      phase,
      error,
      loadProgress,
      isPlaying,
      progressStore,
      start,
      retry,
      play,
      guess,
      skip,
      buyHint,
      next,
      quit,
    }),
    [state, phase, error, loadProgress, isPlaying, progressStore, start, retry, play, guess, skip, buyHint, next, quit]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>.');
  return ctx;
}

/** `{ t, limit }` of the current playback; re-renders only the caller. */
export function useGameProgress() {
  const { progressStore } = useGame();
  return useSyncExternalStore(progressStore.subscribe, progressStore.get, progressStore.get);
}
