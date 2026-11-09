// Authored control glyphs. One family: 24px grid, filled shapes with
// softened corners so they read as printed on a button cap.
const base = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  'aria-hidden': true,
  focusable: 'false',
};

export function PlayIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8.2 4.6c-.9-.55-2.2.1-2.2 1.2v12.4c0 1.1 1.3 1.75 2.2 1.2l10.1-6.2c.9-.55.9-1.85 0-2.4L8.2 4.6Z" />
    </svg>
  );
}

export function StopIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5.5" y="5.5" width="13" height="13" rx="2" />
    </svg>
  );
}

export function SkipIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5.6 5.4c-.8-.5-1.8.05-1.8 1v11.2c0 .95 1 1.5 1.8 1l8.4-5.6c.7-.47.7-1.53 0-2L5.6 5.4Z" />
      <rect x="16.4" y="5" width="3.6" height="14" rx="1.2" />
    </svg>
  );
}

export function HintIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2.8a7 7 0 0 0-4.1 12.67c.5.37.85.95.85 1.58V17.6c0 .5.4.9.9.9h4.7c.5 0 .9-.4.9-.9v-.55c0-.63.35-1.21.85-1.58A7 7 0 0 0 12 2.8Z" />
      <rect x="9.2" y="19.6" width="5.6" height="2.2" rx="1.1" />
    </svg>
  );
}

export function PlusIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="10.3" y="4" width="3.4" height="16" rx="1.2" />
      <rect x="4" y="10.3" width="16" height="3.4" rx="1.2" />
    </svg>
  );
}

export function BackIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10.6 5.1c.75-.62 1.9-.09 1.9.89V9.4h6.3c.66 0 1.2.54 1.2 1.2v2.8c0 .66-.54 1.2-1.2 1.2h-6.3v3.41c0 .98-1.15 1.51-1.9.89l-6.9-5.71a1.53 1.53 0 0 1 0-2.36l6.9-5.71Z" />
    </svg>
  );
}

/** A coin on edge, for the INSERT COIN deck. */
export function CoinIcon(props) {
  return (
    <svg {...base} {...props}>
      <path
        fillRule="evenodd"
        d="M12 2.8a9.2 9.2 0 1 1 0 18.4 9.2 9.2 0 0 1 0-18.4Zm0 3a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4Z"
      />
      <rect x="10.6" y="8" width="2.8" height="8" rx="1.1" />
    </svg>
  );
}
