import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement as h, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext.jsx';
import { DEFAULT_SETTINGS } from '../config/gameConfig.js';
import { load, save } from '../services/storage.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let api;
function Probe() {
  api = useSettings();
  return null;
}

let container;
let root;
function mount() {
  container = document.createElement('div');
  root = createRoot(container);
  // StrictMode re-runs mount effects: catches "skip first run" bugs
  act(() => root.render(h(StrictMode, null, h(SettingsProvider, null, h(Probe)))));
}

beforeEach(() => {
  localStorage.clear();
  api = undefined;
});
afterEach(() => {
  act(() => root.unmount());
});

describe('SettingsContext', () => {
  it('starts from defaults with empty storage and writes nothing on mount', () => {
    mount();
    expect(api[0].challengeLength).toBe(DEFAULT_SETTINGS.challengeLength);
    expect(load('settings', null)).toBeNull();
  });

  it('initialises from saved settings through mergeSettings', () => {
    save('settings', { challengeLength: 10, volume: 7 });
    mount();
    expect(api[0].challengeLength).toBe(10);
    expect(api[0].volume).toBe(1); // clamped
  });

  it('updateSettings merges a patch and persists it', () => {
    mount();
    act(() => api[1]({ endlessLives: 5 }));
    expect(api[0].endlessLives).toBe(5);
    expect(api[0].challengeLength).toBe(DEFAULT_SETTINGS.challengeLength);
    expect(load('settings').endlessLives).toBe(5);
  });

  it('accepts a functional patch and sanitises bad values', () => {
    mount();
    act(() => api[1]((s) => ({ challengeLength: s.challengeLength + 5, stages: [3, 2, 1, 0] })));
    expect(api[0].challengeLength).toBe(DEFAULT_SETTINGS.challengeLength + 5);
    expect(api[0].stages).toEqual([...DEFAULT_SETTINGS.stages]);
  });

  it('resetSettings restores and persists defaults', () => {
    save('settings', { challengeLength: 3 });
    mount();
    act(() => api[2]());
    expect(api[0].challengeLength).toBe(DEFAULT_SETTINGS.challengeLength);
    expect(load('settings').challengeLength).toBe(DEFAULT_SETTINGS.challengeLength);
  });

  it('useSettings throws outside the provider', () => {
    const c = document.createElement('div');
    const r = createRoot(c);
    const orig = console.error;
    console.error = () => {};
    try {
      expect(() => act(() => r.render(h(Probe)))).toThrow(/SettingsProvider/);
    } finally {
      console.error = orig;
      root = r;
    }
  });
});
