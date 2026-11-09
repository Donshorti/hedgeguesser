import { describe, it, expect } from 'vitest';
import { createThrottle } from './throttle.js';

function fakeClock() {
  const clock = { t: 0, waits: [] };
  clock.now = () => clock.t;
  clock.wait = async (ms) => {
    clock.waits.push(ms);
    clock.t += ms;
  };
  return clock;
}

describe('createThrottle', () => {
  it('spaces call starts by at least the interval', async () => {
    const clock = fakeClock();
    const throttle = createThrottle(100, clock.now, clock.wait);
    const starts = [];
    const task = () => throttle(async () => starts.push(clock.t));
    await Promise.all([task(), task(), task()]);
    expect(starts).toEqual([0, 100, 200]);
    expect(clock.waits).toEqual([100, 100]);
  });
  it('does not wait when the interval has already passed', async () => {
    const clock = fakeClock();
    const throttle = createThrottle(100, clock.now, clock.wait);
    await throttle(async () => {});
    clock.t = 250;
    await throttle(async () => {});
    expect(clock.waits).toEqual([]);
  });
  it('returns the task result', async () => {
    const clock = fakeClock();
    const throttle = createThrottle(100, clock.now, clock.wait);
    await expect(throttle(async () => 42)).resolves.toBe(42);
  });
  it('a rejected task rejects its caller but does not break the chain', async () => {
    const clock = fakeClock();
    const throttle = createThrottle(100, clock.now, clock.wait);
    const failed = throttle(async () => { throw new Error('nope'); });
    const next = throttle(async () => 'ok');
    await expect(failed).rejects.toThrow('nope');
    await expect(next).resolves.toBe('ok');
    expect(clock.waits).toEqual([100]);
  });
});
