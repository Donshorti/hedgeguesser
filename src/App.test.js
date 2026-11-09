import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h, StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = () => {}; // jsdom: not implemented
window.HTMLMediaElement.prototype.load = () => {}; // jsdom: not implemented (GameProvider audio)

// jsdom fires hashchange asynchronously after a location.hash write
const go = (hash) =>
  act(async () => {
    window.location.hash = hash;
    await new Promise((r) => setTimeout(r, 20));
  });

let root;
let container;
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('App screen cross-fade', () => {
  it('a screen that returns inside the fade (A → B → A) is live, not inert', async () => {
    window.history.replaceState(null, '', '#/settings');
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(h(StrictMode, null, h(App))));

    await go('#/scores');
    await go('#/settings'); // well inside the 240ms fade / 500ms fallback

    const layers = [...container.querySelectorAll('main > div > div')];
    const current = layers.find((l) => !l.hasAttribute('aria-hidden'));
    const leaving = layers.find((l) => l.hasAttribute('aria-hidden'));
    expect(layers).toHaveLength(2);
    expect(current.inert).toBe(false);
    expect(leaving.inert).toBe(true);

    const heading = current.querySelector('h1');
    expect(heading.textContent).toBe('Settings');
    expect(document.activeElement).toBe(heading); // route focus landed on it
    expect(heading.tabIndex).toBe(-1);
    expect(document.title).toBe('HedgeGuesser — Settings');
  });
});
