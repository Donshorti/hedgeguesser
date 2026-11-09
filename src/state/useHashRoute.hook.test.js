import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement as h, StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { useHashRoute } from './useHashRoute.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let api;
function Probe() {
  api = useHashRoute();
  return null;
}

let root;
function mount() {
  root = createRoot(document.createElement('div'));
  act(() => root.render(h(StrictMode, null, h(Probe))));
}

// jsdom fires hashchange asynchronously after a location.hash write
const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));

beforeEach(() => {
  window.history.replaceState(null, '', '#/');
  api = undefined;
});
afterEach(() => {
  vi.restoreAllMocks();
  if (root) act(() => root.unmount());
  root = undefined;
});

describe('useHashRoute', () => {
  it('replaces (never pushes) an unknown hash with #/', () => {
    window.history.replaceState(null, '', '#/nope');
    const replace = vi.spyOn(window.history, 'replaceState');
    const push = vi.spyOn(window.history, 'pushState');
    const before = window.history.length;
    mount();
    expect(replace).toHaveBeenCalled();
    expect(replace.mock.calls.at(-1)[2]).toBe('#/');
    expect(push).not.toHaveBeenCalled();
    expect(window.history.length).toBe(before);
    expect(window.location.hash).toBe('#/');
    expect(api.path).toBe('/');
  });

  it('reads a deep link on mount', () => {
    window.history.replaceState(null, '', '#/playlists/a1');
    mount();
    expect(api.path).toBe('/playlists/:id');
    expect(api.params).toEqual({ id: 'a1' });
  });

  it('navigate(to) pushes and the route follows hashchange', async () => {
    mount();
    const before = window.history.length;
    act(() => api.navigate('/scores'));
    await settle();
    expect(window.location.hash).toBe('#/scores');
    expect(api.path).toBe('/scores');
    expect(window.history.length).toBe(before + 1);
  });

  it('navigate(to, { replace: true }) updates the route without a new entry', () => {
    mount();
    const before = window.history.length;
    act(() => api.navigate('/settings', { replace: true }));
    expect(api.path).toBe('/settings');
    expect(window.location.hash).toBe('#/settings');
    expect(window.history.length).toBe(before);
  });

  it('navigating to the current location is a no-op', () => {
    window.history.replaceState(null, '', '#/settings/');
    mount();
    const replace = vi.spyOn(window.history, 'replaceState');
    const before = window.history.length;
    act(() => api.navigate('/settings'));
    act(() => api.navigate('#/settings', { replace: true }));
    expect(replace).not.toHaveBeenCalled();
    expect(window.history.length).toBe(before);
    expect(window.location.hash).toBe('#/settings/');
  });

  it('navigate("/") from an empty hash adds no duplicate entry', () => {
    window.history.replaceState(null, '', window.location.pathname);
    mount();
    const before = window.history.length;
    act(() => api.navigate('/'));
    expect(window.history.length).toBe(before);
  });

  it('removes its hashchange listener on unmount', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    mount();
    const added = add.mock.calls.filter(([t]) => t === 'hashchange').map(([, fn]) => fn);
    act(() => root.unmount());
    root = undefined;
    const removed = remove.mock.calls.filter(([t]) => t === 'hashchange').map(([, fn]) => fn);
    expect(added.length).toBeGreaterThan(0);
    expect(removed).toEqual(added);
  });
});
