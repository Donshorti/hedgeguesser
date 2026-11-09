/** Serializes async calls with at least `minIntervalMs` between starts. */
export function createThrottle(minIntervalMs, now = () => Date.now(), wait = (ms) => new Promise((r) => setTimeout(r, ms))) {
  let last = -Infinity;
  let chain = Promise.resolve();
  return (fn) => {
    const run = chain.then(async () => {
      const delay = last + minIntervalMs - now();
      if (delay > 0) await wait(delay);
      last = now();
      return fn();
    });
    chain = run.catch(() => {});
    return run;
  };
}
