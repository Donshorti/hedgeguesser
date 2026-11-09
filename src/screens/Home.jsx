import ArcadeButton from '../components/ArcadeButton.jsx';
import Marquee from '../components/Marquee.jsx';
import styles from './ScreenStub.module.css';

// Placeholder until Task 14 (attract mode). The marquee is the screen's heading.
export default function Home({ navigate }) {
  return (
    <div className={styles.screen}>
      <Marquee as="h1" />
      <nav className={styles.actions} aria-label="Main">
        <ArcadeButton variant="pink" size="md" onClick={() => navigate('/play')}>
          Start
        </ArcadeButton>
        <ArcadeButton variant="amber" size="sm" onClick={() => navigate('/scores')}>
          High scores
        </ArcadeButton>
        <ArcadeButton variant="cyan" size="sm" onClick={() => navigate('/playlists')}>
          Playlists
        </ArcadeButton>
        <ArcadeButton variant="cyan" size="sm" onClick={() => navigate('/settings')}>
          Settings
        </ArcadeButton>
      </nav>
    </div>
  );
}
