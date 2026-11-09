import { useEffect, useId, useRef, useState } from 'react';
import ArcadeButton from './ArcadeButton.jsx';
import { parseImport, saveCustom } from '../services/playlists.js';
import { unmatchedCount, plural } from '../screens/playlistEdit.js';
import styles from './ImportDialog.module.css';

const JSON_EXAMPLE = '{"name":"My mix","tracks":[{"title":"Yesterday","artist":"The Beatles"}]}';
const LINE_EXAMPLE = 'Yesterday - The Beatles';

/**
 * Paste-a-list import in a native modal <dialog>: PARSE previews the list
 * (or shows the parse error under the field), SAVE stores it and hands the
 * saved playlist to `onSaved`. The browser returns focus to the opener on close.
 */
export default function ImportDialog({ open, onClose, onSaved }) {
  const ref = useRef(null);
  const uid = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setText('');
      setError(null);
      setPreview(null);
      setSaveError(null);
      d.showModal?.();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  const parse = () => {
    try {
      setPreview(parseImport(text));
      setError(null);
    } catch (e) {
      setPreview(null);
      setError(e.message || 'That list could not be read.');
    }
  };

  const save = () => {
    const name = preview.name.trim() || 'Imported playlist';
    const saved = saveCustom({ name, color: 'pink', tracks: preview.tracks });
    if (!saved) {
      setSaveError('Couldn’t save — storage full?');
      return;
    }
    onSaved?.(saved);
  };

  const pending = preview ? unmatchedCount(preview.tracks) : 0;

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby={`${uid}-t`} onClose={onClose}>
      <form method="dialog" className={styles.body} onSubmit={(e) => e.preventDefault()}>
        <h2 className={styles.title} id={`${uid}-t`}>
          Import a playlist
        </h2>

        {!preview ? (
          <>
            <label className={styles.label} htmlFor={`${uid}-src`}>
              Paste a list
            </label>
            <textarea
              id={`${uid}-src`}
              className={styles.field}
              rows={8}
              value={text}
              spellCheck={false}
              autoFocus
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${error ? `${uid}-err ` : ''}${uid}-hint`}
            />
            {error ? (
              <p className={styles.error} id={`${uid}-err`} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.hint} id={`${uid}-hint`}>
              <p>JSON, or one song per line:</p>
              <code className={styles.code}>{JSON_EXAMPLE}</code>
              <code className={styles.code}>{LINE_EXAMPLE}</code>
            </div>
            <div className={styles.actions}>
              <ArcadeButton variant="cyan" size="sm" onClick={onClose}>
                Cancel
              </ArcadeButton>
              <ArcadeButton variant="pink" size="sm" onClick={parse}>
                Parse
              </ArcadeButton>
            </div>
          </>
        ) : (
          <>
            <label className={styles.label} htmlFor={`${uid}-name`}>
              Playlist name
            </label>
            <input
              id={`${uid}-name`}
              className={styles.input}
              value={preview.name}
              maxLength={60}
              autoFocus
              onChange={(e) => setPreview({ ...preview, name: e.target.value })}
            />
            <p className={styles.summary} role="status">
              {plural(preview.tracks.length, 'song')} found.
              {pending ? ` ${plural(pending, 'song')} will be matched on first play.` : ''}
            </p>
            <ol className={styles.list}>
              {preview.tracks.map((t, i) => (
                <li key={i}>
                  <span className={styles.songTitle}>{t.title}</span> <span className={styles.songArtist}>{t.artist}</span>
                </li>
              ))}
            </ol>
            {saveError ? (
              <p className={styles.error} role="alert">
                {saveError}
              </p>
            ) : null}
            <div className={styles.actions}>
              <ArcadeButton variant="cyan" size="sm" onClick={() => setPreview(null)}>
                Edit list
              </ArcadeButton>
              <ArcadeButton variant="pink" size="sm" onClick={save}>
                Save
              </ArcadeButton>
            </div>
          </>
        )}
      </form>
    </dialog>
  );
}
