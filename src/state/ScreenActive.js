import { createContext, useContext } from 'react';

/**
 * Whether the screen this component lives in is the live one.
 *
 * During a route cross-fade the outgoing screen stays mounted (inert, hidden
 * from assistive tech) for ~--t-med. Screen-level global listeners (keydown on
 * window, etc.), rAF loops, timers and auto-actions (auto-advance, auto-play)
 * must run only while `useScreenActive()` is true, so they never double up
 * with the incoming screen's (e.g. Game → Results).
 */
export const ScreenActiveContext = createContext(true);

export function useScreenActive() {
  return useContext(ScreenActiveContext);
}
