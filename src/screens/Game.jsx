import { useEffect, useId, useRef, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton.jsx';
import AttemptLog from '../components/AttemptLog.jsx';
import Equalizer from '../components/Equalizer.jsx';
import GuessInput from '../components/GuessInput.jsx';
import HintPanel from '../components/HintPanel.jsx';
import LedPips from '../components/LedPips.jsx';
import Reveal from '../components/Reveal.jsx';
import SegmentScore from '../components/SegmentScore.jsx';
import StageLadder from '../components/StageLadder.jsx';
import { BackIcon, HintIcon, PlayIcon, SkipIcon, StopIcon } from '../components/icons.jsx';
import { useGame, useGameProgress } from '../state/GameContext.jsx';
import { useScreenActive } from '../state/ScreenActive.js';
import { load } from '../services/storage.js';
import Results from './Results.jsx';
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
  // a hit lights the score window while the "+N" rolls in
  const hit = state.status === 'reveal' && state.outcome === 'win';
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
      <SegmentScore value={score} digits={5} label="Score" className={`${styles.score} ${hit ? styles.scoreFlash : ''}`} />
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

export default function Game({ navigate }) {
  const game = useGame();
  const { state, phase, error, loadProgress, isPlaying, progressStore } = game;
  const active = useScreenActive();
  const [hintsOpen, setHintsOpen] = useState(false);
  const inputRef = useRef(null);
  const hintsId = useId();

  // Nothing to show without a run (deep link, reload): back to the jukebox.
  // (Not after quitTo: the hash changes a tick after quit() empties the run.)
  const idle = state.status === 'idle' && phase === 'idle';
  const leaving = useRef(false);
  useEffect(() => {
    if (active && idle && !leaving.current) navigate('/play', { replace: true });
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
    leaving.current = true;
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
        <Results
          state={state}
          onAgain={() => {
            const setup = load('lastSetup', null);
            if (setup?.playlistIds?.length) game.start(setup);
            else quitTo('/play');
          }}
          onHome={() => quitTo('/')}
          onSaved={(mode, date) => {
            try {
              sessionStorage.setItem('hg:newScore', JSON.stringify({ mode, date }));
            } catch {
              /* highlight is a nicety */
            }
            quitTo('/scores');
          }}
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
        <Reveal
          key={songKey}
          track={track}
          outcome={outcome}
          result={state.results[state.results.length - 1]}
          stages={stages}
          mode={state.mode}
          isLast={state.mode === 'endless' ? state.lives <= 0 : state.index + 1 >= state.queue.length}
          onNext={game.next}
        />
      )}
    </div>
  );
}
