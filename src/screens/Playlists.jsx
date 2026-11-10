import { useEffect, useId, useMemo, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton.jsx';
import ImportDialog from '../components/ImportDialog.jsx';
import TitleStrip from '../components/TitleStrip.jsx';
import { BackIcon, PlusIcon } from '../components/icons.jsx';
import { getAllPlaylists } from '../services/catalog.js';
import { duplicatePlaylist } from './playlistEdit.js';
import styles from './Playlists.module.css';

/** Playlists: your own (open to edit), the house selection (duplicate to edit), import. */
export default function Playlists({ navigate, spotifyResume = null, onSpotifyResumeDone }) {
  const catalog = useMemo(() => getAllPlaylists(), []);
  const house = catalog.filter((p) => !p.custom);
  const mine = catalog.filter((p) => p.custom);
  // back from Spotify's login: the import dialog reopens and carries on with the link
  const [resume, setResume] = useState(spotifyResume);
  const [importing, setImporting] = useState(Boolean(spotifyResume));
  useEffect(() => {
    if (spotifyResume) onSpotifyResumeDone?.();
  }, [spotifyResume, onSpotifyResumeDone]);
  const [error, setError] = useState(null);
  const uid = useId();

  const open = (id) => navigate(`/playlists/${encodeURIComponent(id)}`);

  const duplicate = (p) => {
    const saved = duplicatePlaylist(p, catalog);
    if (!saved) setError('Couldn’t save — storage full?');
    else open(saved.id);
  };

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <ArcadeButton variant="neutral" size="sm" icon={<BackIcon />} onClick={() => navigate('/')}>
          Back
        </ArcadeButton>
        <h1 className={styles.title} data-screen-heading>
          Playlists
        </h1>
      </header>

      <div className={styles.toolbar}>
        <ArcadeButton variant="pink" size="sm" icon={<PlusIcon />} onClick={() => navigate('/playlists/new')}>
          New playlist
        </ArcadeButton>
        <ArcadeButton variant="neutral" size="sm" onClick={() => setImporting(true)}>
          Import
        </ArcadeButton>
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <section className={styles.group} aria-labelledby={`${uid}-mine`}>
        <h2 className={styles.groupTitle} id={`${uid}-mine`}>
          Your playlists
        </h2>
        {mine.length ? (
          <ul className={styles.strips} role="list">
            {mine.map((p) => (
              <li key={p.id}>
                <TitleStrip
                  code={p.code}
                  name={p.name}
                  count={p.tracks.length}
                  color={`var(--${p.color})`}
                  aria-pressed={undefined}
                  aria-label={`Edit ${p.name}, ${p.tracks.length} ${p.tracks.length === 1 ? 'song' : 'songs'}`}
                  onClick={() => open(p.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.none}>No playlists yet — build one by searching, or paste a list or a Spotify link.</p>
        )}
      </section>

      <section className={styles.group} aria-labelledby={`${uid}-house`}>
        <h2 className={styles.groupTitle} id={`${uid}-house`}>
          House selection
        </h2>
        <p className={styles.note}>House playlists are fixed. Duplicate one to make it yours.</p>
        <ul className={styles.houseList} role="list">
          {house.map((p) => (
            <li key={p.id} className={styles.houseRow} style={{ '--band': `var(--${p.color})` }}>
              <span className={styles.houseCode} aria-hidden="true">
                {p.code}
              </span>
              <span className={styles.houseText}>
                <span className={styles.houseName}>{p.name}</span>
                <span className={styles.houseMeta}>
                  {p.tracks.length} {p.tracks.length === 1 ? 'song' : 'songs'}
                </span>
              </span>
              <ArcadeButton variant="neutral" size="sm" aria-label={`Duplicate ${p.name}`} onClick={() => duplicate(p)}>
                Duplicate
              </ArcadeButton>
            </li>
          ))}
        </ul>
      </section>

      <ImportDialog
        open={importing}
        resume={resume}
        onClose={() => {
          setImporting(false);
          setResume(null);
        }}
        onSaved={(p) => {
          setImporting(false);
          open(p.id);
        }}
      />
    </div>
  );
}
