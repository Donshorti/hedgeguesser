import { forwardRef, useId, useMemo, useState } from 'react';
import { suggest, suggestionIndex } from './suggest.js';
import styles from './GuessInput.module.css';

/**
 * Guess field with an ARIA 1.2 combobox: pool-title suggestions after two
 * characters. Arrows move the highlight; Enter or a click on a suggestion
 * fills the field with it, and a second Enter (or the send key) submits.
 * Escape closes the list. Clears after a guess.
 */
const GuessInput = forwardRef(function GuessInput({ poolTitles, onGuess, disabled }, ref) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const index = useMemo(() => suggestionIndex(poolTitles ?? []), [poolTitles]);
  const options = useMemo(() => suggest(index, text), [index, text]);
  const expanded = open && options.length > 0;

  const submit = (value) => {
    const v = String(value ?? '').trim();
    if (!v || disabled) return;
    onGuess(v);
    setText('');
    setOpen(false);
    setActive(-1);
  };

  /** Put a suggestion in the field without guessing yet. */
  const fill = (title) => {
    setText(title);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!options.length) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => {
        const n = options.length;
        if (!expanded) return step > 0 ? 0 : n - 1;
        const next = i + step;
        return next < -1 ? n - 1 : next >= n ? -1 : next;
      });
    } else if (e.key === 'Escape' && expanded) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (expanded && active >= 0) fill(options[active]);
      else submit(text);
    }
  };

  return (
    <form
      className={styles.field}
      role="search"
      aria-label="Guess the song"
      onSubmit={(e) => {
        e.preventDefault();
        submit(text);
      }}
    >
      <input
        ref={ref}
        className={styles.input}
        type="text"
        role="combobox"
        aria-label="Song title"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${id}-opt-${active}` : undefined}
        placeholder="Type the song title"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
        value={text}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        onFocus={() => setOpen(true)}
      />
      <button className={styles.send} type="submit" aria-label="Submit guess" disabled={disabled || !text.trim()}>
        <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M4.5 11h11.1l-4.3-4.3a1 1 0 0 1 1.4-1.4l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4-1.4l4.3-4.3H4.5a1 1 0 1 1 0-2Z" />
        </svg>
      </button>
      <ul id={listId} role="listbox" aria-label="Matching titles" className={styles.list} hidden={!expanded}>
        {expanded
          ? options.map((title, i) => (
              <li
                key={title}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? `${styles.option} ${styles.active}` : styles.option}
                // keep focus in the input; a pick fills the field, it does not guess
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => fill(title)}
                onMouseEnter={() => setActive(i)}
              >
                {title}
              </li>
            ))
          : null}
      </ul>
    </form>
  );
});

export default GuessInput;
