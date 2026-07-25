import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface FeatureFlag {
  name: string;
  enabled: boolean;
}

const FLAGS_CACHE_KEY = 'openframe:feature-flags-v1';

/**
 * Last server-resolved flag values, persisted for ONE purpose: loading
 * skeletons that must guess a flag-dependent layout before the flags arrive.
 *
 * `FeatureFlagsGate` blocks the app on the flags query, and the route skeleton
 * is what it renders while blocking — so any flag read from a skeleton happens
 * with `isLoaded === false` and falls back to the env default. When the server
 * disagrees with that default the skeleton picks the wrong layout and visibly
 * swaps on handoff. Replaying the previous answer fixes that from the second
 * visit on; a cold profile still falls back to the env default.
 *
 * Deliberately NOT wired into `getFlagValue`: real behavior keeps reading the
 * store (or the env default) so a stale entry can never gate a real feature.
 */
export function readCachedFeatureFlags(): Record<string, boolean> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FLAGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedFeatureFlags(flags: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FLAGS_CACHE_KEY, JSON.stringify(flags));
  } catch {
    // Private mode / quota — skeletons fall back to the env defaults.
  }
}

export interface FeatureFlagsState {
  flags: Record<string, boolean>;
  isLoaded: boolean;
  setFlags: (flags: FeatureFlag[]) => void;
  setLoaded: () => void;
  reset: () => void;
}

export const useFeatureFlagsStore = create<FeatureFlagsState>()(
  devtools(
    immer(set => ({
      flags: {},
      isLoaded: false,

      setFlags: flags =>
        set(state => {
          state.flags = {};
          for (const flag of flags) {
            state.flags[flag.name] = flag.enabled;
          }
          state.isLoaded = true;
          writeCachedFeatureFlags(state.flags);
        }),

      setLoaded: () =>
        set(state => {
          state.isLoaded = true;
        }),

      reset: () =>
        set(state => {
          state.flags = {};
          state.isLoaded = false;
        }),
    })),
    { name: 'feature-flags-store' },
  ),
);
