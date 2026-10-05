import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface FeatureFlag {
  name: string;
  enabled: boolean;
}

/**
 * Server-loaded feature flags.
 *
 * **Deliberately not cached.** Values come from `feFeatureFlags` on every load and
 * from nowhere else — no `localStorage`, no cookie. A replayed previous answer
 * would remove the first-render guess, but it would also mean a flag flipped
 * server-side keeps its old value until the next reload; in the native shell,
 * whose session outlives many navigations and rarely reloads, "until the next
 * reload" can mean days. Stale behaviour is a worse failure than a load state.
 *
 * The consequence is that `isLoaded === false` is a REAL state that consumers
 * must handle, not a transient to paper over: before the answer there is no flag
 * value, and rendering the env default in its place is a guess that is wrong
 * whenever the server disagrees — visibly (chrome appears/disappears) or
 * functionally (a flag-gated route redirects as if it were disabled). See
 * `useFeatureFlag` / `useFeatureFlagsReady` for how consumers are expected to
 * express "not answered yet".
 */
export interface FeatureFlagsState {
  flags: Record<string, boolean>;
  /** The server has answered (or terminally failed). Until then there is no value. */
  isLoaded: boolean;
  setFlags: (flags: FeatureFlag[]) => void;
  setLoaded: () => void;
  reset: () => void;
}

export const useFeatureFlagsStore = create<FeatureFlagsState>()(
  devtools(
    immer<FeatureFlagsState>(set => ({
      flags: {},
      isLoaded: false,

      setFlags: flags => {
        const next: Record<string, boolean> = {};
        for (const flag of flags) {
          next[flag.name] = flag.enabled;
        }
        set(state => {
          state.flags = next;
          state.isLoaded = true;
        });
      },

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
