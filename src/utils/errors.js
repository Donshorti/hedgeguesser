/** An error callers can recognise as a deliberate cancellation and ignore. */
export function abortError(message = 'aborted') {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

export function isAbortError(err) {
  return err?.name === 'AbortError';
}

/** An error with a machine-readable `code` (e.g. 'timeout', 'unreachable'). */
export function codedError(code, message = code) {
  const err = new Error(message);
  err.code = code;
  return err;
}
