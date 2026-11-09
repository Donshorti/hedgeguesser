import { useEffect, useRef, useState } from 'react';
import { SettingsProvider } from './state/SettingsContext.jsx';
import { useHashRoute } from './state/useHashRoute.js';
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
function ScreenStack({ screenKey, children }) {
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

  return (
    <div className={styles.stack}>
      {leaving ? (
        <div key={leaving.key} className={`${styles.layer} ${styles.leaving}`} aria-hidden="true" inert="" onAnimationEnd={done}>
          {leaving.node}
        </div>
      ) : null}
      <div key={screenKey} className={`${styles.layer} ${leaving ? styles.entering : ''}`}>
        {children}
      </div>
    </div>
  );
}

function RoutedScreen() {
  const { path, params, location, navigate } = useHashRoute();
  const { Screen, title } = SCREENS[path] ?? SCREENS['/'];
  const mainRef = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    document.title = title ? `HedgeGuesser — ${title}` : 'HedgeGuesser';
  }, [title]);

  // a11y: on route change, land focus on the new screen's main heading.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    const current = mainRef.current?.querySelector(`.${styles.layer}:not([inert])`);
    const heading = current?.querySelector('[data-screen-heading]') ?? current?.querySelector('h1');
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }, [location]);

  return (
    <main ref={mainRef} className={styles.column}>
      <ScreenStack screenKey={location}>
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
