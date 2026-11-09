import { useEffect, useId, useRef, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton.jsx';
import { BackIcon, PlayIcon, StopIcon } from '../components/icons.jsx';
import { HINTS, validStages } from '../config/gameConfig.js';
import { getAllPlaylists } from '../services/catalog.js';
import { lookupTracks } from '../services/itunes.js';
import { clearAll } from '../services/storage.js';
import { useSettings } from '../state/SettingsContext.jsx';
import styles from './Settings.module.css';

const HINT_LABELS = { year: 'Release year', genre: 'Genre', artistInitials: 'Artist initials', firstLetter: 'First letter' };
const COUNTRIES = [
  ['US', 'United States'],
  ['GB', 'United Kingdom'],
  ['ES', 'Spain'],
  ['MX', 'Mexico'],
  ['AR', 'Argentina'],
  ['CO', 'Colombia'],
  ['CL', 'Chile'],
  ['FR', 'France'],
  ['DE', 'Germany'],
  ['IT', 'Italy'],
  ['BR', 'Brazil'],
  ['CA', 'Canada'],
  ['AU', 'Australia'],
  ['JP', 'Japan'],
];
const TEST_MS = 2000;

const num = (s) => (String(s).trim() === '' ? NaN : Number(s));

/** A number field that keeps what you type and only reports values `check` accepts. */
function NumberField({ label, value, onCommit, check, unit, step = 1, min, max, describedBy }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const bad = check(num(draft)) !== true;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <span className={styles.box}>
        <input
          id={id}
          className={styles.input}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={draft}
          aria-invalid={bad || undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = num(e.target.value);
            if (check(n) === true) onCommit(n);
          }}
          onBlur={() => {
            if (bad) setDraft(String(value));
          }}
        />
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </span>
    </div>
  );
}

const isWhole = (lo, hi) => (n) => Number.isInteger(n) && n >= lo && n <= hi;
const isCost = (n) => Number.isInteger(n) && n >= 0 && n <= 99999;

function Group({ title, children, error, errorId, wide }) {
  return (
    <fieldset className={`${styles.group} ${wide ? styles.wide : ''}`}>
      <legend className={styles.legend}>{title}</legend>
      {children}
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Stage lengths are validated as a set: each longer than the last, all within 30s. */
function StageFields({ stages, onCommit }) {
  const errorId = useId();
  const [draft, setDraft] = useState(() => stages.map(String));
  const parsed = draft.map(num);
  const ok = validStages(parsed);
  return (
    <Group
      title="Stage lengths"
      errorId={errorId}
      error={ok ? null : 'Each stage must be longer than the one before, from above 0s up to 30s.'}
    >
      <div className={styles.quad}>
        {draft.map((v, i) => (
          <div className={styles.field} key={i}>
            <label className={styles.label} htmlFor={`${errorId}-s${i}`}>
              Stage {i + 1}
            </label>
            <span className={styles.box}>
              <input
                id={`${errorId}-s${i}`}
                className={styles.input}
                type="number"
                inputMode="decimal"
                step={0.5}
                min={0.5}
                max={30}
                value={v}
                aria-invalid={ok ? undefined : true}
                aria-describedby={ok ? undefined : errorId}
                onChange={(e) => {
                  const next = draft.map((d, j) => (j === i ? e.target.value : d));
                  setDraft(next);
                  const n = next.map(num);
                  if (validStages(n)) onCommit(n);
                }}
              />
              <span className={styles.unit}>s</span>
            </span>
          </div>
        ))}
      </div>
    </Group>
  );
}

/** About two seconds of the first house song at the chosen volume. */
function useTestPreview(volume, country) {
  const [state, setState] = useState('idle'); // idle · loading · playing · failed
  const audio = useRef(null);
  const timer = useRef(0);
  const url = useRef(null);

  const stop = () => {
    clearTimeout(timer.current);
    audio.current?.pause();
    audio.current = null;
    setState('idle');
  };

  useEffect(() => () => {
    clearTimeout(timer.current);
    audio.current?.pause();
  }, []);

  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);

  const play = async () => {
    if (state === 'playing' || state === 'loading') return stop();
    setState('loading');
    try {
      if (!url.current) {
        const first = getAllPlaylists().find((p) => !p.custom && p.tracks.some((t) => t.id));
        const id = first?.tracks.find((t) => t.id)?.id;
        const found = id ? await lookupTracks([id], { country }) : null;
        url.current = found?.get(id)?.previewUrl ?? null;
      }
      if (!url.current) throw new Error('no preview');
      const a = new Audio(url.current);
      a.volume = volume;
      audio.current = a;
      await a.play();
      setState('playing');
      timer.current = setTimeout(stop, TEST_MS);
    } catch {
      audio.current = null;
      setState('failed');
    }
  };

  return [state, play];
}

export default function Settings({ navigate }) {
  const [settings, updateSettings, resetSettings] = useSettings();
  // bumping this remounts the fields so their drafts pick up reset values
  const [generation, setGeneration] = useState(0);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [testState, testPlay] = useTestPreview(settings.volume, settings.country);
  const ids = { lives: useId(), length: useId(), country: useId(), volume: useId(), test: useId() };

  const resetDefaults = () => {
    resetSettings();
    setGeneration((g) => g + 1);
  };

  const wipe = () => {
    clearAll();
    resetSettings();
    navigate('/');
  };

  const pct = Math.round(settings.volume * 100);

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <ArcadeButton variant="cyan" size="sm" icon={<BackIcon />} aria-label="Back to home" onClick={() => navigate('/')} />
        <h1 className={styles.title} data-screen-heading>
          Settings
        </h1>
      </header>

      <div className={styles.grid} key={generation}>
        <StageFields stages={settings.stages} onCommit={(stages) => updateSettings({ stages })} />

        <Group title="Points per stage">
          <div className={styles.quad}>
            {settings.stagePoints.map((p, i) => (
              <NumberField
                key={i}
                label={`Stage ${i + 1}`}
                value={p}
                min={0}
                step={50}
                check={isCost}
                onCommit={(n) =>
                  updateSettings((prev) => ({ stagePoints: prev.stagePoints.map((v, j) => (j === i ? n : v)) }))
                }
              />
            ))}
          </div>
        </Group>

        <Group title="Runs">
          <div className={styles.pair}>
            <NumberField
              label="Endless lives"
              value={settings.endlessLives}
              min={1}
              max={9}
              check={isWhole(1, 9)}
              describedBy={ids.lives}
              onCommit={(endlessLives) => updateSettings({ endlessLives })}
            />
            <NumberField
              label="Challenge songs"
              value={settings.challengeLength}
              min={1}
              max={50}
              check={isWhole(1, 50)}
              describedBy={ids.length}
              onCommit={(challengeLength) => updateSettings({ challengeLength })}
            />
          </div>
          <p className={styles.note}>
            <span id={ids.lives}>Lives 1–9.</span> <span id={ids.length}>Songs 1–50.</span>
          </p>
        </Group>

        <Group title="Hint costs">
          <div className={styles.pair}>
            {HINTS.map((h) => (
              <NumberField
                key={h}
                label={HINT_LABELS[h]}
                value={settings.hintCosts[h]}
                min={0}
                step={50}
                unit="pts"
                check={isCost}
                onCommit={(n) => updateSettings((prev) => ({ hintCosts: { ...prev.hintCosts, [h]: n } }))}
              />
            ))}
          </div>
        </Group>

        <Group title="Sound">
          <div className={styles.field}>
            <label className={styles.label} htmlFor={ids.volume}>
              Volume <span className={`num ${styles.readout}`}>{pct}%</span>
            </label>
            <div className={styles.volumeRow}>
              <input
                id={ids.volume}
                className={styles.slider}
                type="range"
                min={0}
                max={100}
                step={5}
                value={pct}
                aria-valuetext={`${pct}%`}
                style={{ '--fill': `${pct}%` }}
                onChange={(e) => updateSettings({ volume: Number(e.target.value) / 100 })}
              />
              <ArcadeButton
                variant="pink"
                size="sm"
                icon={testState === 'playing' ? <StopIcon /> : <PlayIcon />}
                aria-describedby={ids.test}
                onClick={testPlay}
              >
                {testState === 'loading' ? 'Loading' : testState === 'playing' ? 'Stop' : 'Test'}
              </ArcadeButton>
            </div>
            <p id={ids.test} className={styles.note} aria-live="polite">
              {testState === 'failed' ? "Couldn't load a test song. Check your connection." : 'Plays two seconds of a song.'}
            </p>
          </div>
        </Group>

        <Group title="Music store">
          <div className={styles.field}>
            <label className={styles.label} htmlFor={ids.country}>
              iTunes country
            </label>
            <select
              id={ids.country}
              className={styles.select}
              value={settings.country}
              onChange={(e) => updateSettings({ country: e.target.value })}
            >
              {COUNTRIES.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} · {name}
                </option>
              ))}
            </select>
          </div>
          <p className={styles.note}>Which store finds the songs. Some songs only play in some countries.</p>
        </Group>
      </div>

      <section className={styles.danger} aria-labelledby="settings-reset">
        <h2 id="settings-reset" className="visually-hidden">
          Reset
        </h2>
        <ArcadeButton variant="cyan" size="md" onClick={resetDefaults}>
          Reset defaults
        </ArcadeButton>
        {confirmWipe ? (
          <div className={styles.confirm} role="alert">
            <p className={styles.confirmText}>Wipe every playlist, score and setting? This can't be undone.</p>
            <div className={styles.confirmActions}>
              <ArcadeButton variant="pink" size="md" onClick={wipe}>
                Yes, wipe it
              </ArcadeButton>
              <ArcadeButton variant="cyan" size="md" onClick={() => setConfirmWipe(false)}>
                Cancel
              </ArcadeButton>
            </div>
          </div>
        ) : (
          <ArcadeButton variant="amber" size="md" onClick={() => setConfirmWipe(true)}>
            Reset all data
          </ArcadeButton>
        )}
      </section>
    </div>
  );
}
