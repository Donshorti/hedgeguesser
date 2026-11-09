import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StagePlayer } from './StagePlayer.js';

class FakeAudio {
  currentTime = 0; volume = 1; paused = true; ended = false; src = ''; preload = '';
  listeners = {};
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  load = vi.fn();
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((x) => x !== f); }
  emit(t) { (this.listeners[t] || []).slice().forEach((f) => f()); }
}

let audio, frames, player;
const step = () => { const fs = frames; frames = []; fs.forEach((f) => f()); };

beforeEach(() => {
  audio = new FakeAudio();
  frames = [];
  player = new StagePlayer({
    audio,
    raf: (cb) => frames.push(cb),
    caf: () => { frames = []; },
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
  it('load rejects on error', async () => {
    const p = player.load('bad.mp3');
    audio.emit('error');
    await expect(p).rejects.toThrow('audio-error');
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
    audio.play = vi.fn(() => new Promise((r) => { resolve = r; }));
    const p = player.play(5);
    player.stop();
    resolve();
    await p;
    expect(audio.pause).toHaveBeenCalled();
    expect(frames).toHaveLength(0);
  });
  it('restores volume after stop', async () => {
    await player.play(1);
    audio.currentTime = 0.99; step();
    player.stop();
    expect(audio.volume).toBe(1);
  });
});
