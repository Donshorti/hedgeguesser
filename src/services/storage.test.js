import { describe, it, expect, beforeEach } from 'vitest';
import { load, save, remove, PREFIX } from './storage.js';

beforeEach(() => localStorage.clear());

describe('storage', () => {
  it('round-trips JSON under a versioned prefix', () => {
    save('x', { a: 1 });
    expect(localStorage.getItem(`${PREFIX}x`)).toBe('{"a":1}');
    expect(load('x', null)).toEqual({ a: 1 });
  });
  it('returns fallback for missing keys', () => {
    expect(load('missing', 42)).toBe(42);
  });
  it('recovers from corrupt data by removing it', () => {
    localStorage.setItem(`${PREFIX}bad`, '{not json');
    expect(load('bad', 'fb')).toBe('fb');
    expect(localStorage.getItem(`${PREFIX}bad`)).toBeNull();
  });
  it('remove deletes the key', () => {
    save('y', 1);
    remove('y');
    expect(load('y', null)).toBeNull();
  });
});
