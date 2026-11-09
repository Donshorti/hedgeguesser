import { useEffect, useId, useRef, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton.jsx';
import AttemptLog from '../components/AttemptLog.jsx';
import Equalizer from '../components/Equalizer.jsx';
import GuessInput from '../components/GuessInput.jsx';
import HintPanel from '../components/HintPanel.jsx';
import LedPips from '../components/LedPips.jsx';
import SegmentScore from '../components/SegmentScore.jsx';
import StageLadder from '../components/StageLadder.jsx';
import { BackIcon, HintIcon, PlayIcon, SkipIcon, StopIcon } from '../components/icons.jsx';
import { useGame, useGameProgress } from '../state/GameContext.jsx';
import { useScreenActive } from '../state/ScreenActive.js';
import { load } from '../services/storage.js';
import styles from './Game.module.css';

const pad2 = (n) => String(n).padStart(2, '0');
const secs = (s) => `${s}s`;

/** True when a key press is going into something that takes text or its own Space. */
function isTypingTarget(el) {
  if (!el || el === document.body) return false;
  if (el.isContentEditable) return true;
  return /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName) || el.getAttribute?.('role') === 'option';
}

/** The ladder re-renders with playback progress; the rest of the screen does not. */
function LiveLadder({ stages, stage, attempts, outcome, playing }) {
  const { t } = useGameProgress();
  return <StageLadder stages={stages} stage={stage} attempts={attempts} outcome={outcome} t={playing ? t : null} />;
}

function StatusStrip({ state, onQuit }) {
  const { mode, index, queue, lives, score, settings } = state;
  const challenge = mode === 'challenge';
  return (
    <header className={styles.status}>
      <ArcadeButton variant="cyan" size="sm" icon={<BackIcon />} aria-label="Quit to the jukebox" onClick={onQuit} />
      <div className={styles.round}>
        <h1 className={styles.mode} data-screen-heading>
          {challenge ? 'Challenge' : 'Endless'}
        </h1>
        <p className={styles.count}>
          {challenge ? (
            <>
              <span className="visually-hidden">Song </span>
              {pad2(index + 1)} <span aria-hidden="true">/</span>
              <span className="visually-hidden"> of </span> {pad2(queue.length)}
            </>
          ) : (
            `Song ${index + 1}`
          )}
        </p>
      </div>
      {challenge ? null : (
        <LedPips total={settings.endlessLives} lit={lives} label={`${lives} ${lives === 1 ? 'life' : 'lives'} left`} />
      )}
      <SegmentScore value={score} digits={5} label="Score" className={styles.score} />
    </header>
  );
}

function Panel({ title, children, actions, live }) {
  return (
    <section className={styles.panel} aria-live={live ? 'polite' : undefined}>
      <h1 className={styles.panelTitle} data-screen-heading>
        {title}
      </h1>
      {children}
      {actions ? <div className={styles.panelActions}>{actions}</div> : null}
    </section>
  );
}

function Loading({ progress, onBack }) {
  const { done = 0, total = 0 } = progress ?? {};
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <Panel
      title="Loading songs"
      live
      actions={
        <ArcadeButton variant="cyan" size="sm" icon={<BackIcon />} onClick={onBack}>
          Back
        </ArcadeButton>
      }
    >
      <div
        className={styles.meter}
        role="progressbar"
        aria-label="Songs resolved"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <span className={styles.meterFill} style={{ width: `${pct}%` }} />
      </div>
      <p className={styles.panelText}>
        Resolving <span className="num">{done}</span> / <span className="num">{total}</span>
      </p>
    </Panel>
  );
}

const ERRORS = {
  offline: {
    title: 'Out of order',
    text: "Can't reach the music store, so there's nothing to play. Check your connection and try again.",
    retry: true,
  },
  'not-enough': {
    title: 'Not enough songs',
    text: 'Too few of those songs have a playable preview. Pick more playlists on the jukebox.',
    retry: false,
  },
};

function Failure({ error, onRetry, onBack }) {
  const e = ERRORS[error] ?? ERRORS.offline;
  return (
    <Panel
      title={e.title}
      actions={
        <>
          {e.retry ? (
            <ArcadeButton variant="pink" size="md" onClick={onRetry}>
              Retry
            </ArcadeButton>
          ) : null}
          <ArcadeButton variant="cyan" size="md" icon={<BackIcon />} onClick={onBack}>
            Jukebox
          </ArcadeButton>
        </>
      }
    >
      <p className={styles.panelText}>{e.text}</p>
    </Panel>
  );
}

/** Minimal reveal; Task 17 replaces it with the full one. */
function Reveal({ state, onNext }) {
  const track = state.queue[state.index];
  const win = state.outcome === 'win';
  const result = state.results[state.results.length - 1];
  return (
    <section className={styles.reveal} aria-live="polite">
      {track.artwork ? <img className={styles.art} src={track.artwork} alt="" width="160" height="160" /> : null}
      <div className={styles.revealText}>
        <p className={win ? styles.win : styles.lose}>
          {win ? `Got it at ${secs(state.settings.stages[result?.stage ?? 0])} · +${result?.points ?? 0}` : 'Missed it'}
        </p>
        <h2 className={styles.trackTitle}>{track.title}</h2>
        <p className={styles.trackArtist}>{track.artist}</p>
      </div>
      <ArcadeButton variant="pink" size="md" autoFocus onClick={onNext}>
        Next
      </ArcadeButton>
    </section>
  );
}

/** Minimal game over; Task 18 replaces it with results and initials. */
function GameOver({ score, onAgain, onHome }) {
  return (
    <Panel
      title="Game over"
      actions={
        <>
          <ArcadeButton variant="pink" size="md" onClick={onAgain}>
            Play again
          </ArcadeButton>
          <ArcadeButton variant="cyan" size="md" onClick={onHome}>
            Home
          </ArcadeButton>
        </>
      }
    >
      <SegmentScore value={score} digits={6} label="Final score" />
    </Panel>
  );
}

export default function Game({ navigate }) {
  const game = useGame();
  const { state, phase, error, loadProgress, isPlaying, progressStore } = game;
  const active = useScreenActive();
  const [hintsOpen, setHintsOpen] = useState(false);
  const inputRef = useRef(null);
  const hintsId = useId();

  // Nothing to show without a run (deep link, reload): back to the jukebox.
  const idle = state.status === 'idle' && phase === 'idle';
  useEffect(() => {
    if (active && idle) navigate('/play', { replace: true });
  }, [active, idle, navigate]);

  const track = state.queue[state.index];
  const songKey = track ? `${state.index}:${track.id}` : '';
  useEffect(() => setHintsOpen(false), [songKey]);

  // Space plays (when not typing or on a control); Ctrl+→ skips.
  const keys = useRef(null);
  keys.current = { game, state, phase };
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      const { game: g, state: s, phase: p } = keys.current;
      if (s.status !== 'playing') return;
      if (e.key === ' ' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        if (p === 'ready') g.play();
      } else if (e.key === 'ArrowRight' && e.ctrlKey) {
        e.preventDefault();
        g.skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const quitTo = (to) => {
    game.quit();
    navigate(to);
  };

  if (idle) return null;

  if (error) {
    return (
      <div className={styles.screen}>
        <Failure error={error} onRetry={game.retry} onBack={() => quitTo('/play')} />
      </div>
    );
  }

  if (loadProgress || state.status === 'idle') {
    return (
      <div className={styles.screen}>
        <Loading progress={loadProgress} onBack={() => quitTo('/play')} />
      </div>
    );
  }

  if (state.status === 'over') {
    return (
      <div className={styles.screen}>
        <GameOver
          score={state.score}
          onAgain={() => {
            const setup = load('lastSetup', null);
            if (setup?.playlistIds?.length) game.start(setup);
            else quitTo('/play');
          }}
          onHome={() => quitTo('/')}
        />
      </div>
    );
  }

  const { settings, stage, attempts, hintsUsed, score, outcome } = state;
  const stages = settings.stages;
  const playingRound = state.status === 'playing';
  const ready = phase === 'ready';
  const nextStage = stages[stage + 1];
  const skipLabel = nextStage ? `+${nextStage - stages[stage]}s` : 'Give up';

  return (
    <div className={styles.screen}>
      <StatusStrip state={state} onQuit={() => quitTo('/play')} />

      <div className={styles.crt}>
        <Equalizer playing={isPlaying} seed={track?.id} getProgress={progressStore.get} active={active} />
      </div>

      <LiveLadder stages={stages} stage={stage} attempts={attempts} outcome={outcome} playing={isPlaying} />

      {playingRound ? (
        <div className={styles.deck}>
          <div className={styles.playRow}>
            <ArcadeButton
              variant="pink"
              size="xl"
              icon={isPlaying ? <StopIcon /> : <PlayIcon />}
              disabled={!ready}
              onClick={game.play}
            >
              {!ready ? 'Loading…' : isPlaying ? 'Stop' : `Play ${secs(stages[stage])}`}
            </ArcadeButton>
          </div>

          <GuessInput ref={inputRef} poolTitles={state.poolTitles} onGuess={game.guess} />

          <div className={styles.secondary}>
            <ArcadeButton variant="cyan" size="sm" icon={<SkipIcon />} onClick={game.skip}>
              Skip <span className={styles.btnNote}>{skipLabel}</span>
            </ArcadeButton>
            <ArcadeButton
              variant="amber"
              size="sm"
              icon={<HintIcon />}
              aria-expanded={hintsOpen}
              aria-controls={hintsId}
              onClick={() => setHintsOpen((o) => !o)}
            >
              Hint
            </ArcadeButton>
          </div>

          <HintPanel
            id={hintsId}
            open={hintsOpen}
            track={track}
            hintsUsed={hintsUsed}
            costs={settings.hintCosts}
            score={score}
            onBuy={game.buyHint}
          />

          <AttemptLog attempts={attempts} rows={stages.length} />
        </div>
      ) : (
        <Reveal key={songKey} state={state} onNext={game.next} />
      )}
    </div>
  );
}
