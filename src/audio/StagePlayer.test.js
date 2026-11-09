import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StagePlayer } from './StagePlayer.js';

class FakeAudio {
  currentTime = 0; volume = 1; paused = true; ended = false; src = ''; preload = '';
  listeners = {};
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  load = vi.fn();
  removeAttribute = vi.fn((name) => { if (name === 'src') this.src = ''; });
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((x) => x !== f); }
  emit(t) { (this.listeners[t] || []).slice().forEach((f) => f()); }
  listenerCount() { return Object.values(this.listeners).reduce((n, l) => n + l.length, 0); }
}

let audio, frames, timers, player;
const step = () => { const fs = frames; frames = []; fs.forEach((f) => f()); };
/** Fire every pending timer whose delay is at most `maxMs` (default: all). */
const fireTimers = (maxMs = Infinity) => {
  const due = timers.filter((t) => t.ms <= maxMs);
  timers = timers.filter((t) => t.ms > maxMs);
  due.forEach((t) => t.fn());
};

beforeEach(() => {
  audio = new FakeAudio();
  frames = [];
  timers = [];
  let nextTimer = 1;
  player = new StagePlayer({
    audio,
    raf: (cb) => frames.push(cb),
    caf: () => { frames = []; },
    setTimer: (fn, ms) => { const id = nextTimer++; timers.push({ id, fn, ms }); return id; },
    clearTimer: (id) => { timers = timers.filter((t) => t.id !== id); },
    fadeMs: 40,
  });
  player.setVolume(1);
});

describe('StagePlayer', () => {
  it('load resolves on canplaythrough', async () => {
    const p = player.load('a.mp3');
    expect(audio.src).toBe('a.mp3');
    audio.emit('canplaythrough');
    await expect(p).resolves.toBeUndefined();
  });
  it.each(['loadedmetadata', 'canplay'])('load also resolves on %s (iOS readiness)', async (event) => {
    const p = player.load('a.mp3');
    audio.emit(event);
    await expect(p).resolves.toBeUndefined();
    expect(audio.listenerCount()).toBe(0);
  });
  it('load rejects on error', async () => {
    const p = player.load('bad.mp3');
    audio.emit('error');
    await expect(p).rejects.toThrow('audio-error');
  });
  it('load rejects on timeout', async () => {
    const p = player.load('slow.mp3');
    fireTimers();
    await expect(p).rejects.toThrow('audio-timeout');
    expect(audio.listenerCount()).toBe(0);
  });
  it('a second load aborts the first; only the second resolves', async () => {
    const a = player.load('a.mp3');
    const b = player.load('b.mp3');
    await expect(a).rejects.toMatchObject({ name: 'AbortError' });
    audio.emit('canplaythrough');
    await expect(b).resolves.toBeUndefined();
    expect(audio.listenerCount()).toBe(0);
    expect(timers).toHaveLength(0);
  });
  it.each(['stop', 'destroy'])('%s aborts a pending load', async (method) => {
    const p = player.load('a.mp3');
    player[method]();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(audio.listenerCount()).toBe(0);
  });
  it('plays from 0 and stops exactly at the limit', async () => {
    const onEnd = vi.fn();
    player.onEnd = onEnd;
    audio.currentTime = 12;
    await player.play(0.5);
    expect(audio.currentTime).toBe(0);
    audio.currentTime = 0.3; step();
    expect(audio.pause).not.toHaveBeenCalled();
    audio.currentTime = 0.5; step();
    expect(audio.pause).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(0);
    expect(timers).toHaveLength(0);
  });
  it('a backup timer stops playback when animation frames never fire', async () => {
    const onEnd = vi.fn();
    player.onEnd = onEnd;
    await player.play(0.5);
    expect(timers).toHaveLength(1);
    expect(timers[0].ms).toBe(550);
    audio.currentTime = 0.6; // background tab: audio kept playing, no rAF ran
    fireTimers();
    expect(audio.paused).toBe(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
    step(); // a late frame must not end it twice
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
  it('the backup timer re-arms if playback is behind the limit', async () => {
    const onEnd = vi.fn();
    player.onEnd = onEnd;
    await player.play(5);
    audio.currentTime = 4; // stalled while buffering
    fireTimers();
    expect(onEnd).not.toHaveBeenCalled();
    expect(timers).toHaveLength(1);
    expect(timers[0].ms).toBe(1050);
    audio.currentTime = 5;
    fireTimers();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
  it('onEnd fires once when the frame path wins', async () => {
    const onEnd = vi.fn();
    player.onEnd = onEnd;
    await player.play(0.5);
    audio.currentTime = 0.5; step();
    fireTimers();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
  it('fades volume in the last 40ms', async () => {
    await player.play(1);
    audio.currentTime = 0.98; step();
    expect(audio.volume).toBeCloseTo(0.5, 2);
  });
  it('reports progress', async () => {
    const onProgress = vi.fn();
    player.onProgress = onProgress;
    await player.play(5);
    audio.currentTime = 2; step();
    expect(onProgress).toHaveBeenLastCalledWith(2, 5);
  });
  it('stop during a pending play leaves audio paused and no loop', async () => {
    let resolve;
    audio.play = vi.fn(() => { audio.paused = false; return new Promise((r) => { resolve = r; }); });
    const p = player.play(5);
    player.stop();
    resolve();
    await p;
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.paused).toBe(true);
    expect(frames).toHaveLength(0);
    expect(timers).toHaveLength(0);
  });
  it('restores volume after stop', async () => {
    await player.play(1);
    audio.currentTime = 0.99; step();
    player.stop();
    expect(audio.volume).toBe(1);
  });
  it('unlock plays and pauses once, swallowing errors', () => {
    audio.play = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    expect(() => player.unlock()).not.toThrow();
    player.unlock();
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.pause).toHaveBeenCalledTimes(1);
  });
  it('unlock swallows a synchronous play() throw', () => {
    audio.play = vi.fn(() => { throw new Error('boom'); });
    expect(() => player.unlock()).not.toThrow();
  });
  it('destroy clears the source and reloads to release the network', () => {
    player.load('a.mp3').catch(() => {});
    player.destroy();
    expect(audio.removeAttribute).toHaveBeenCalledWith('src');
    expect(audio.load).toHaveBeenCalledTimes(2);
  });
});
