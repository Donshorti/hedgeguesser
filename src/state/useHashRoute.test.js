import { describe, it, expect } from 'vitest';
import { parseHash, toHash } from './useHashRoute.js';

describe('parseHash', () => {
  it.each([
    ['#/', '/'],
    ['#/play', '/play'],
    ['#/game', '/game'],
    ['#/scores', '/scores'],
    ['#/playlists', '/playlists'],
    ['#/settings', '/settings'],
  ])('%s → %s', (hash, path) => {
    const r = parseHash(hash);
    expect(r.path).toBe(path);
    expect(r.params).toEqual({});
    expect(r.matched).toBe(true);
  });

  it('extracts :id from #/playlists/:id', () => {
    const r = parseHash('#/playlists/abc123');
    expect(r).toEqual({
      path: '/playlists/:id',
      params: { id: 'abc123' },
      location: '/playlists/abc123',
      matched: true,
    });
  });

  it('decodes encoded params and survives malformed escapes', () => {
    expect(parseHash('#/playlists/my%20mix').params).toEqual({ id: 'my mix' });
    expect(parseHash('#/playlists/%E0%A4%A').params).toEqual({ id: '%E0%A4%A' });
  });

  it('treats empty hash, "#" and missing hash as home', () => {
    for (const h of ['', '#', undefined, null]) {
      const r = parseHash(h);
      expect(r.path).toBe('/');
      expect(r.matched).toBe(true);
    }
  });

  it('sends unknown routes home, flagged unmatched', () => {
    for (const h of ['#/nope', '#/play/extra', '#/playlists/a/b', '#play', '#/Settings']) {
      const r = parseHash(h);
      expect(r.path).toBe('/');
      expect(r.params).toEqual({});
      expect(r.matched).toBe(false);
    }
  });

  it('tolerates trailing slashes', () => {
    expect(parseHash('#/settings/').path).toBe('/settings');
    expect(parseHash('#/playlists/').path).toBe('/playlists');
    const r = parseHash('#/playlists/xyz/');
    expect(r.path).toBe('/playlists/:id');
    expect(r.params).toEqual({ id: 'xyz' });
    expect(r.location).toBe('/playlists/xyz');
  });

  it('ignores a query string', () => {
    expect(parseHash('#/scores?mode=endless').path).toBe('/scores');
  });

  it('works without the leading "#"', () => {
    expect(parseHash('/game').path).toBe('/game');
  });
});

describe('toHash', () => {
  it('normalises targets to "#/…"', () => {
    expect(toHash('/settings')).toBe('#/settings');
    expect(toHash('#/play')).toBe('#/play');
    expect(toHash('scores')).toBe('#/scores');
    expect(toHash('/')).toBe('#/');
  });
});
