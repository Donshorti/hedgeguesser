/**
 * Plays a preview from 0:00 up to a stage limit, fading out over the last
 * `fadeMs` to avoid a click, then pausing. One instance per page.
 * Note: iOS ignores audio.volume, so the fade is a no-op there; the cut is still clean.
 */
export class StagePlayer {
  constructor({ audio, raf, caf, fadeMs = 40, loadTimeoutMs = 10000 } = {}) {
    this.audio = audio ?? new Audio();
    this.audio.preload = 'auto';
    this.raf = raf ?? ((cb) => requestAnimationFrame(cb));
    this.caf = caf ?? ((id) => cancelAnimationFrame(id));
    this.fade = fadeMs / 1000;
    this.loadTimeoutMs = loadTimeoutMs;
    this.volume = 0.8;
    this.limit = 0;
    this.frame = null;
    this.token = 0;
    this.playing = false;
    this.onProgress = null;
    this.onEnd = null;
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (!this.playing) this.audio.volume = this.volume;
  }

  load(url) {
    this.stop();
    const a = this.audio;
    return new Promise((resolve, reject) => {
      let timer;
      const finish = (fn, arg) => {
        clearTimeout(timer);
        a.removeEventListener('canplaythrough', ok);
        a.removeEventListener('error', bad);
        fn(arg);
      };
      const ok = () => finish(resolve);
      const bad = () => finish(reject, new Error('audio-error'));
      timer = setTimeout(() => finish(reject, new Error('audio-timeout')), this.loadTimeoutMs);
      a.addEventListener('canplaythrough', ok);
      a.addEventListener('error', bad);
      a.src = url;
      a.load();
    });
  }

  async play(limit) {
    this.stop();
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
  }

  #tick(token) {
    this.frame = this.raf(() => {
      if (token !== this.token) return;
      const t = this.audio.currentTime;
      const remaining = this.limit - t;
      this.onProgress?.(Math.min(t, this.limit), this.limit);
      if (remaining <= 0 || this.audio.ended) {
        this.stop();
        this.onEnd?.();
        return;
      }
      this.audio.volume = remaining < this.fade ? this.volume * (remaining / this.fade) : this.volume;
      this.#tick(token);
    });
  }

  stop() {
    this.token++;
    if (this.frame != null) this.caf(this.frame);
    this.frame = null;
    if (!this.audio.paused) this.audio.pause();
    this.audio.volume = this.volume;
    this.playing = false;
  }

  destroy() {
    this.stop();
    this.audio.removeAttribute?.('src');
    this.onEnd = this.onProgress = null;
  }
}
