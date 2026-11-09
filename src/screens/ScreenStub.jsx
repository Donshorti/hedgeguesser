import ArcadeButton from '../components/ArcadeButton.jsx';
import Marquee from '../components/Marquee.jsx';
import styles from './ScreenStub.module.css';

/**
 * Temporary screen body used until each screen's own task replaces it:
 * the marquee, the screen's heading, optional route buttons, and Back.
 * `links` is a list of `{ to, label }`.
 */
export default function ScreenStub({ title, navigate, links = [], children }) {
  return (
    <div className={styles.screen}>
      <Marquee as="div" />
      <h1 className={styles.heading} data-screen-heading>
        {title}
      </h1>
      {children}
      <nav className={styles.actions} aria-label="Screen">
        {links.map((l) => (
          <ArcadeButton key={l.to} variant="pink" size="md" onClick={() => navigate(l.to)}>
            {l.label}
          </ArcadeButton>
        ))}
        <ArcadeButton variant="cyan" size="sm" onClick={() => navigate('/')}>
          Back
        </ArcadeButton>
      </nav>
    </div>
  );
}
