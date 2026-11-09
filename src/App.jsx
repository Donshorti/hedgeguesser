import { useEffect, useRef, useState } from 'react';
import { SettingsProvider } from './state/SettingsContext.jsx';
import { useHashRoute } from './state/useHashRoute.js';
import { ScreenActiveContext } from './state/ScreenActive.js';
import Home from './screens/Home.jsx';
import PlaySetup from './screens/PlaySetup.jsx';
import Game from './screens/Game.jsx';
import Scores from './screens/Scores.jsx';
import Playlists from './screens/Playlists.jsx';
import PlaylistDetail from './screens/PlaylistDetail.jsx';
import Settings from './screens/Settings.jsx';
import styles from './App.module.css';

const SCREENS = {
  '/': { Screen: Home, title: null },
  '/play': { Screen: PlaySetup, title: 'Play' },
  '/game': { Screen: Game, title: 'Game' },
  '/scores': { Screen: Scores, title: 'High scores' },
  '/playlists': { Screen: Playlists, title: 'Playlists' },
  '/playlists/:id': { Screen: PlaylistDetail, title: 'Playlist' },
  '/settings': { Screen: Settings, title: 'Settings' },
};

/**
 * App-wide state providers. Task 15 adds <GameProvider> inside
 * <SettingsProvider> here (the game reads settings).
 */
function Providers({ children }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Cross-fades between screens: the outgoing screen stays mounted (inert,
 * hidden from AT) while it fades out over --t-med under the incoming one.
 * Reduced motion swaps instantly.
 */
function ScreenStack({ screenKey, currentRef, children }) {
  const [current, setCurrent] = useState(screenKey);
  const [leaving, setLeaving] = useState(null);
  const lastNode = useRef(children);

  if (current !== screenKey) {
    setCurrent(screenKey);
    setLeaving(prefersReducedMotion() ? null : { key: current, node: lastNode.current });
  }

  useEffect(() => {
    lastNode.current = children;
  });

  useEffect(() => {
    if (!leaving) return undefined;
    // fallback in case animationend never fires (hidden tab, etc.)
    const t = setTimeout(() => setLeaving(null), 500);
    return () => clearTimeout(t);
  }, [leaving]);

  const done = (e) => {
    if (e.target === e.currentTarget) setLeaving(null);
  };

  // Both layers render the same element shape (div > Provider > screen) so
  // the outgoing screen keeps its instance; only the Provider value flips.
  return (
    <div className={styles.stack}>
      {leaving ? (
        <div key={leaving.key} ref={makeInert} className={`${styles.layer} ${styles.leaving}`} aria-hidden="true" onAnimationEnd={done}>
          <ScreenActiveContext.Provider value={false}>{leaving.node}</ScreenActiveContext.Provider>
        </div>
      ) : null}
      <div key={screenKey} ref={currentRef} className={`${styles.layer} ${leaving ? styles.entering : ''}`}>
        <ScreenActiveContext.Provider value={true}>{children}</ScreenActiveContext.Provider>
      </div>
    </div>
  );
}

// Set as a DOM property: React 18 has no `inert` prop and React 19 treats it
// as a boolean, so neither string form is safe across versions.
function makeInert(el) {
  if (el) el.inert = true;
}

function RoutedScreen() {
  const { path, params, location, navigate } = useHashRoute();
  const { Screen, title } = SCREENS[path] ?? SCREENS['/'];
  const currentRef = useRef(null);
  // last location we handled; comparing values (not a first-run flag) keeps
  // StrictMode's effect re-run from scrolling/focusing on first load
  const prevLocation = useRef(location);

  useEffect(() => {
    document.title = title ? `HedgeGuesser — ${title}` : 'HedgeGuesser';
  }, [title]);

  // a11y: on route change, land focus on the new screen's main heading.
  useEffect(() => {
    if (prevLocation.current === location) return;
    prevLocation.current = location;
    window.scrollTo(0, 0);
    const current = currentRef.current;
    // a screen that autofocused its own control (e.g. the guess field) keeps it
    if (!current || current.contains(document.activeElement)) return;
    const heading = current.querySelector('[data-screen-heading]') ?? current.querySelector('h1');
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }, [location]);

  return (
    <main className={styles.column}>
      <ScreenStack screenKey={location} currentRef={currentRef}>
        <Screen params={params} navigate={navigate} />
      </ScreenStack>
    </main>
  );
}

export default function App() {
  return (
    <Providers>
      <div className={styles.shell}>
        <RoutedScreen />
      </div>
    </Providers>
  );
}
