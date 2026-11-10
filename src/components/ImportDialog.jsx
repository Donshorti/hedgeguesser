import { useEffect, useId, useRef, useState } from 'react';
import ArcadeButton from './ArcadeButton.jsx';
import { parseImport, saveCustom } from '../services/playlists.js';
import {
  beginLogin,
  fetchSpotifyTracks,
  forgetToken,
  getAccessToken,
  needsLogin,
  parseSpotifyLink,
  spotifyErrorMessage,
} from '../services/spotify.js';
import { unmatchedCount, plural } from '../screens/playlistEdit.js';
import styles from './ImportDialog.module.css';

const JSON_EXAMPLE = '{"name":"My mix","tracks":[{"title":"Yesterday","artist":"The Beatles"}]}';
const LINE_EXAMPLE = 'Yesterday - The Beatles';
const LINK_EXAMPLE = 'https://open.spotify.com/playlist/…';

/**
 * Paste-a-list import in a native modal <dialog>: PARSE previews the list
 * (or shows the parse error under the field), SAVE stores it and hands the
 * saved playlist to `onSaved`. The browser returns focus to the opener on close.
 *
 * A pasted Spotify playlist or album link is fetched from Spotify instead, after a
 * one-time login. `resume` (`{link, error}`) reopens the dialog on the way back from
 * that login and carries on with the link.
 */
export default function ImportDialog({ open, onClose, onSaved, resume = null }) {
  const ref = useRef(null);
  const uid = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saveError, setSaveError] = useState(null);
  /** Spotify step: null | {phase: 'connect'|'loading'} | {phase: 'error', code}. */
  const [spotify, setSpotify] = useState(null);
  const run = useRef(0);

  const fetchSpotify = async (link) => {
    const mine = ++run.current;
    const current = () => mine === run.current;
    setError(null);
    setSpotify({ phase: 'loading' });
    try {
      const token = await getAccessToken();
      if (!current()) return;
      if (!token) {
        setSpotify({ phase: 'connect' });
        return;
      }
      const found = await fetchSpotifyTracks(link, token);
      if (!current()) return;
      setSpotify(null);
      setPreview(found);
    } catch (err) {
      if (!current()) return;
      if (err.code === 'auth') forgetToken();
      setSpotify({ phase: 'error', code: err.code ?? 'failed' });
    }
  };

  const backToList = () => {
    run.current += 1;
    setSpotify(null);
  };

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setText('');
      setError(null);
      setPreview(null);
      setSaveError(null);
      setSpotify(null);
      run.current += 1;
      d.showModal?.();
      if (resume) {
        setText(resume.link ?? '');
        const link = parseSpotifyLink(resume.link);
        if (resume.error) setSpotify({ phase: 'error', code: resume.error });
        else if (link) fetchSpotify(link);
      }
    } else if (!open && d.open) {
      run.current += 1;
      d.close();
    }
    // `resume` is read once, when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const parse = () => {
    const link = parseSpotifyLink(text);
    if (link) {
      fetchSpotify(link);
      return;
    }
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

        {spotify ? (
          <>
            {spotify.phase === 'loading' ? (
              <p className={styles.summary} role="status">
                Reading the list from Spotify…
              </p>
            ) : spotify.phase === 'connect' ? (
              <p className={styles.summary}>You’ll log in to Spotify once, then come straight back.</p>
            ) : (
              <p className={styles.error} role="alert">
                {spotifyErrorMessage(spotify.code)}
              </p>
            )}
            <div className={styles.actions}>
              <ArcadeButton variant="neutral" size="sm" onClick={backToList}>
                Edit list
              </ArcadeButton>
              {spotify.phase === 'connect' || (spotify.phase === 'error' && needsLogin(spotify.code)) ? (
                <ArcadeButton variant="pink" size="sm" autoFocus onClick={() => beginLogin(text.trim())}>
                  Connect Spotify
                </ArcadeButton>
              ) : spotify.phase === 'error' ? (
                <ArcadeButton variant="pink" size="sm" autoFocus onClick={parse}>
                  Try again
                </ArcadeButton>
              ) : null}
            </div>
          </>
        ) : !preview ? (
          <>
            <label className={styles.label} htmlFor={`${uid}-src`}>
              Paste a list or a Spotify link
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
              <p>A Spotify playlist or album link, JSON, or one song per line:</p>
              <code className={styles.code}>{LINK_EXAMPLE}</code>
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
              {pending ? ` ${plural(pending, 'song')} will be matched on first play — about 3 s per song.` : ''}
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
