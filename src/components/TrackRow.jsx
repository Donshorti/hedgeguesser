import { PlayIcon, StopIcon } from './icons.jsx';
import styles from './TrackRow.module.css';

/**
 * One song on a playlist screen: artwork thumb, title, artist, year, an
 * optional 3s preview toggle and one trailing action (ADD / Remove).
 * `onPreview` is omitted for songs with no preview to play.
 */
export default function TrackRow({ track, playing = false, onPreview, action }) {
  const thumb = track.artwork ? track.artwork.replace('600x600bb', '100x100bb') : null;
  const label = `${track.title} by ${track.artist}`;
  return (
    <div className={styles.row}>
      {thumb ? (
        <img className={styles.thumb} src={thumb} alt="" width="48" height="48" loading="lazy" decoding="async" />
      ) : (
        <span className={styles.thumb} aria-hidden="true" />
      )}
      <span className={styles.text}>
        <span className={styles.title}>{track.title}</span>
        <span className={styles.meta}>
          {track.artist}
          {track.year ? <span className={styles.year}> · {track.year}</span> : null}
        </span>
      </span>
      {onPreview ? (
        <button
          type="button"
          className={`${styles.preview} ${playing ? styles.playing : ''}`}
          aria-label={playing ? `Stop preview of ${label}` : `Preview ${label}`}
          aria-pressed={playing}
          onClick={onPreview}
        >
          {playing ? <StopIcon /> : <PlayIcon />}
        </button>
      ) : null}
      {action ? <span className={styles.action}>{action}</span> : null}
    </div>
  );
}
