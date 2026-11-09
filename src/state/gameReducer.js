import { isCorrectGuess } from '../utils/fuzzyMatch.js';

export const initialGameState = Object.freeze({
  status: 'idle', // idle | playing | reveal | over
  mode: null, // challenge | endless
  settings: null,
  queue: [],
  reserve: [],
  index: 0,
  stage: 0,
  attempts: [],
  hintsUsed: [],
  score: 0,
  lives: 0,
  results: [],
  outcome: null, // win | lose
  poolTitles: [],
});

const freshSong = { stage: 0, attempts: [], hintsUsed: [], outcome: null };

function failOrAdvance(state) {
  if (state.stage < state.settings.stages.length - 1) {
    return { ...state, stage: state.stage + 1 };
  }
  const track = state.queue[state.index];
  return {
    ...state,
    status: 'reveal',
    outcome: 'lose',
    lives: state.mode === 'endless' ? state.lives - 1 : state.lives,
    results: [...state.results, { trackId: track.id, stage: null, points: 0 }],
  };
}

export function gameReducer(state, action) {
  switch (action.type) {
    case 'START': {
      const { mode, tracks, settings } = action;
      const len = mode === 'challenge' ? Math.min(settings.challengeLength, tracks.length) : tracks.length;
      return {
        ...initialGameState,
        status: tracks.length ? 'playing' : 'over',
        mode,
        settings,
        queue: tracks.slice(0, len),
        reserve: tracks.slice(len),
        lives: mode === 'endless' ? settings.endlessLives : 0,
        poolTitles: tracks.map((t) => t.title),
      };
    }
    case 'GUESS': {
      if (state.status !== 'playing') return state;
      const text = String(action.text ?? '').trim();
      if (!text) return state;
      const track = state.queue[state.index];
      const correct = isCorrectGuess(text, track.title, state.poolTitles);
      const attempts = [...state.attempts, { type: 'guess', text, correct }];
      if (!correct) return failOrAdvance({ ...state, attempts });
      const points = state.settings.stagePoints[state.stage] ?? 0;
      return {
        ...state,
        attempts,
        status: 'reveal',
        outcome: 'win',
        score: state.score + points,
        results: [...state.results, { trackId: track.id, stage: state.stage, points }],
      };
    }
    case 'SKIP': {
      if (state.status !== 'playing') return state;
      return failOrAdvance({ ...state, attempts: [...state.attempts, { type: 'skip' }] });
    }
    case 'BUY_HINT': {
      const cost = state.settings?.hintCosts?.[action.hint];
      if (
        state.status !== 'playing' ||
        cost == null ||
        state.hintsUsed.includes(action.hint) ||
        state.score < cost
      ) {
        return state;
      }
      return { ...state, score: state.score - cost, hintsUsed: [...state.hintsUsed, action.hint] };
    }
    case 'REPLACE_CURRENT': {
      if (state.status !== 'playing') return state;
      // Hints bought for an unplayable song are refunded.
      const refund = state.hintsUsed.reduce((sum, h) => sum + (state.settings.hintCosts?.[h] ?? 0), 0);
      const score = state.score + refund;
      const queue = [...state.queue];
      if (state.reserve.length) {
        queue[state.index] = state.reserve[0];
        return { ...state, ...freshSong, score, queue, reserve: state.reserve.slice(1) };
      }
      let poolTitles = state.poolTitles;
      if (state.mode === 'endless' && action.refill?.length) {
        queue.push(...action.refill);
        poolTitles = [...poolTitles, ...action.refill.map((t) => t.title)];
      }
      queue.splice(state.index, 1);
      if (state.index >= queue.length) return { ...state, score, queue, poolTitles, status: 'over' };
      return { ...state, ...freshSong, score, queue, poolTitles };
    }
    case 'NEXT': {
      if (state.status !== 'reveal') return state;
      if (state.mode === 'endless' && state.lives <= 0) return { ...state, status: 'over' };
      let queue = state.queue;
      let poolTitles = state.poolTitles;
      if (state.index + 1 >= queue.length) {
        if (state.mode === 'challenge' || !action.refill?.length) return { ...state, status: 'over' };
        queue = [...queue, ...action.refill];
        poolTitles = [...poolTitles, ...action.refill.map((t) => t.title)];
      }
      return { ...state, ...freshSong, queue, poolTitles, index: state.index + 1, status: 'playing' };
    }
    case 'QUIT':
      return initialGameState;
    default:
      return state;
  }
}
