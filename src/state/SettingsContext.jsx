import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { mergeSettings } from '../config/gameConfig.js';
import { load, save } from '../services/storage.js';

const KEY = 'settings';
const SettingsContext = createContext(null);

/**
 * Holds the player's settings, always passed through `mergeSettings` so the
 * rest of the app only ever sees a valid shape. Persists on every change.
 */
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => mergeSettings(load(KEY)));
  const first = useRef(true);

  useEffect(() => {
    // don't write defaults back on mount; only persist real changes
    if (first.current) {
      first.current = false;
      return;
    }
    save(KEY, settings);
  }, [settings]);

  /** `patch` is a partial settings object, or `(prev) => partial`. */
  const updateSettings = useCallback((patch) => {
    setSettings((prev) => {
      const p = typeof patch === 'function' ? patch(prev) : patch;
      return mergeSettings({ ...prev, ...p });
    });
  }, []);

  const resetSettings = useCallback(() => setSettings(mergeSettings()), []);

  const value = useMemo(() => [settings, updateSettings, resetSettings], [settings, updateSettings, resetSettings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** `[settings, updateSettings, resetSettings]` */
export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>.');
  return ctx;
}
