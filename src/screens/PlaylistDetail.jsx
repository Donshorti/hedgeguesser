import ScreenStub from './ScreenStub.jsx';
import styles from './ScreenStub.module.css';

// Placeholder until the playlist editor task.
export default function PlaylistDetail({ navigate, params }) {
  return (
    <ScreenStub title="Playlist" navigate={navigate}>
      <p className={styles.note}>Playlist id: {params.id}</p>
    </ScreenStub>
  );
}
