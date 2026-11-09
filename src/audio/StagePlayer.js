import { abortError } from '../utils/errors.js';

/** Any of these means the element can start playing; iOS often never fires canplaythrough before a gesture. */
const READY_EVENTS = ['loadedmetadata', 'canplay', 'canplaythrough'];
/** Slack added to the backup timer so the frame loop normally wins. */
const BACKUP_SLACK_MS = 50;

/**
 * Plays a preview from 0:00 up to a stage limit, fading out over the last
 * `fadeMs` to avoid a click, then pausing. One instance per page.
 * Note: iOS ignores audio.volume, so the fade is a no-op there; the cut is still clean.
 *
 * The cutoff is driven by requestAnimationFrame, backed by a timer for background
 * tabs where frames stop. Whichever path reaches the limit first ends playback;
 * `onEnd` fires exactly once per play.
 */
export class StagePlayer {
  constructor({ audio, raf, caf, setTimer, clearTimer, fadeMs = 40, loadTimeoutMs = 10000 } = {}) {
    this.audio = audio ?? new Audio();
    this.audio.preload = 'auto';
    this.raf = raf ?? ((cb) => requestAnimationFrame(cb));
    this.caf = caf ?? ((id) => cancelAnimationFrame(id));
    this.setTimer = setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = clearTimer ?? ((id) => clearTimeout(id));
    this.fade = fadeMs / 1000;
    this.loadTimeoutMs = loadTimeoutMs;
    this.volume = 0.8;
    this.limit = 0;
    this.frame = null;
    this.timer = null;
    this.token = 0;
    this.playing = false;
    this.unlocked = false;
    this.pendingLoad = null;
    this.onProgress = null;
    this.onEnd = null;
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (!this.playing) this.audio.volume = this.volume;
  }

  /** Call from the first user gesture so later programmatic play() is allowed (iOS/Safari). */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      const p = this.audio.play();
      p?.catch?.(() => {});
      if (!this.playing) this.audio.pause();
    } catch {
      /* autoplay refused; a later gesture-driven play() still works */
    }
  }

  /** Resolves when the source can play; rejects with AbortError if superseded by load/stop/destroy. */
  load(url) {
    this.stop();
    const a = this.audio;
    return new Promise((resolve, reject) => {
      const settle = (fn, arg) => {
        this.clearTimer(timer);
        READY_EVENTS.forEach((e) => a.removeEventListener(e, ok));
        a.removeEventListener('error', bad);
        if (this.pendingLoad === pending) this.pendingLoad = null;
        fn(arg);
      };
      const ok = () => settle(resolve);
      const bad = () => settle(reject, new Error('audio-error'));
      const pending = { abort: () => settle(reject, abortError('audio-load-aborted')) };
      const timer = this.setTimer(() => settle(reject, new Error('audio-timeout')), this.loadTimeoutMs);
      this.pendingLoad = pending;
      READY_EVENTS.forEach((e) => a.addEventListener(e, ok));
      a.addEventListener('error', bad);
      a.src = url;
      a.load();
    });
  }

  async play(limit) {
    this.#halt();
    const token = this.token;
    this.limit = limit;
    this.audio.currentTime = 0;
    this.audio.volume = this.volume;
    try {
      await this.audio.play();
    } catch (err) {
      if (token === this.token) throw err;
      return;
    }
    if (token !== this.token) {
      this.audio.pause();
      return;
    }
    this.playing = true;
    this.#tick(token);
    this.#armBackup(token);
  }

  #tick(token) {
    this.frame = this.raf(() => {
      if (token !== this.token) return;
      const t = this.audio.currentTime;
      const remaining = this.limit - t;
      this.onProgress?.(Math.min(t, this.limit), this.limit);
      if (remaining <= 0 || this.audio.ended) {
        this.#finish();
        return;
      }
      this.audio.volume = remaining < this.fade ? this.volume * (remaining / this.fade) : this.volume;
      this.#tick(token);
    });
  }

  /** Backup cutoff for background tabs, re-armed while playback lags behind the limit. */
  #armBackup(token) {
    const remaining = this.limit - this.audio.currentTime;
    this.timer = this.setTimer(() => {
      this.timer = null;
      if (token !== this.token) return;
      if (this.audio.currentTime >= this.limit || this.audio.ended) this.#finish();
      else this.#armBackup(token);
    }, Math.max(0, remaining) * 1000 + BACKUP_SLACK_MS);
  }

  #finish() {
    this.#halt();
    this.onEnd?.();
  }

  /** Stop playback without touching a pending load. */
  #halt() {
    this.token++;
    if (this.frame != null) this.caf(this.frame);
    if (this.timer != null) this.clearTimer(this.timer);
    this.frame = null;
    this.timer = null;
    if (!this.audio.paused) this.audio.pause();
    this.audio.volume = this.volume;
    this.playing = false;
  }

  stop() {
    this.pendingLoad?.abort();
    this.#halt();
  }

  destroy() {
    this.stop();
    this.audio.removeAttribute?.('src');
    this.audio.load?.();
    this.onEnd = this.onProgress = null;
  }
}
