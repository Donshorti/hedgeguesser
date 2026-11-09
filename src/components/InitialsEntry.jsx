import { useEffect, useId, useRef, useState } from 'react';
import ArcadeButton from './ArcadeButton.jsx';
import { sanitizeInitials } from '../utils/highScores.js';
import styles from './InitialsEntry.module.css';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SLOTS = 3;
const TOUCH = '(pointer: coarse), (max-width: 479px)';

function useTouchLayout() {
  const [touch] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(TOUCH).matches);
  return touch;
}

/**
 * Arcade initials: three lit slots. ↑/↓ cycle A–Z0–9, ←/→ move, typing fills
 * and advances, Backspace steps back, Enter saves. Touch screens get a plain
 * three-letter field instead.
 */
export default function InitialsEntry({ onSubmit }) {
  const touch = useTouchLayout();
  // one state object so fast typing never reads a stale slot
  const [{ letters, pos }, setSlots] = useState({ letters: ['A', 'A', 'A'], pos: 0 });
  const [text, setText] = useState('');
  const groupRef = useRef(null);
  const inputRef = useRef(null);
  const uid = useId();

  useEffect(() => {
    (touch ? inputRef : groupRef).current?.focus({ preventScroll: true });
  }, [touch]);

  const value = touch ? sanitizeInitials(text) : letters.join('');
  const canSave = value.length > 0;
  const submit = () => {
    if (canSave) onSubmit(value);
  };

  const setPos = (fn) => setSlots((st) => ({ ...st, pos: Math.max(0, Math.min(SLOTS - 1, fn(st.pos))) }));
  const cycle = (dir) =>
    setSlots((st) => {
      const at = CHARS.indexOf(st.letters[st.pos]);
      const ch = CHARS[(at + dir + CHARS.length) % CHARS.length];
      return { ...st, letters: st.letters.map((c, j) => (j === st.pos ? ch : c)) };
    });
  const type = (ch) =>
    setSlots((st) => ({
      letters: st.letters.map((c, j) => (j === st.pos ? ch : c)),
      pos: Math.min(SLOTS - 1, st.pos + 1),
    }));

  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === 'ArrowUp') cycle(1);
    else if (k === 'ArrowDown') cycle(-1);
    else if (k === 'ArrowLeft' || k === 'Backspace') setPos((p) => p - 1);
    else if (k === 'ArrowRight') setPos((p) => p + 1);
    else if (k === 'Enter') submit();
    else if (k.length === 1 && /[a-z0-9]/i.test(k)) {
      type(k.toUpperCase());
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <form
      className={styles.entry}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p id={`${uid}-label`} className={styles.prompt}>
        New high score — enter your initials
      </p>

      {touch ? (
        <input
          ref={inputRef}
          className={styles.field}
          aria-labelledby={`${uid}-label`}
          value={text}
          maxLength={SLOTS}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => setText(sanitizeInitials(e.target.value))}
        />
      ) : (
        <>
          <div
            ref={groupRef}
            className={styles.slots}
            role="group"
            tabIndex={0}
            aria-labelledby={`${uid}-label`}
            aria-describedby={`${uid}-help`}
            onKeyDown={onKeyDown}
          >
            {letters.map((ch, i) => (
              <span
                key={i}
                className={`${styles.slot} ${i === pos ? styles.current : ''}`}
                aria-hidden="true"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setPos(() => i);
                  groupRef.current?.focus();
                }}
              >
                {ch}
              </span>
            ))}
            <span className="visually-hidden" aria-live="polite">
              {letters.join(' ')}, letter {pos + 1} of {SLOTS}
            </span>
          </div>
          <p id={`${uid}-help`} className={styles.help}>
            <kbd>↑</kbd>
            <kbd>↓</kbd> letter · <kbd>←</kbd>
            <kbd>→</kbd> slot · or just type
          </p>
        </>
      )}

      <ArcadeButton type="submit" variant="pink" size="md" disabled={!canSave}>
        Enter
      </ArcadeButton>
    </form>
  );
}
