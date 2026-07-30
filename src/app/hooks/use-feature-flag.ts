'use client';

import type { FeatureFlagGate, FeatureFlagName } from '@/lib/feature-flags';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

/**
 * Why `FeatureFlagGate` (declared in `@/lib/feature-flags`) keeps "not answered
 * yet" separate from "off":
 *
 * Flags are not cached (see `feature-flags-store.ts`), so every load has a window
 * with no flag values at all, and the env default is NOT a safe stand-in for that
 * window — it is a guess, wrong whenever the server disagrees. Two ways that has
 * actually broken:
 * - **Functionally.** A flag-gated route read `false` before the answer and
 *   redirected away as if the feature were off — refreshing `/scripts-v2` bounced
 *   to legacy `/scripts`. Route gates that `notFound()` were worse: it throws, so
 *   the 404 stuck for the whole page life.
 * - **Visibly.** Chrome is gated in BOTH directions — some flags REPLACE or HIDE
 *   pre-feature UI when on (`scripts-v2` swaps which page the Scripts nav item
 *   opens; `mingo-sidebar` hides the legacy Mingo entry) — so "default off" isn't
 *   "show less", it's "show the pre-feature app", including nav entries that must
 *   not be there at all.
 *
 * Making the window a value the compiler forces you to name is what stops both.
 */

/**
 * The server has answered, or terminally failed (`FeatureFlagsLoader` marks flags
 * loaded on query error and in saas-shared mode, so this always resolves).
 *
 * Used by the app shell to hold its stub until the chrome can be rendered complete:
 * the sidebar's contents are flag-shaped, so rendering it earlier means either a
 * partly-built nav or entries that don't belong to the tenant.
 */
export function useFeatureFlagsReady(): boolean {
  return useFeatureFlagsStore(state => state.isLoaded);
}

/**
 * Flag read for anything whose WRONG value is not acceptable for a frame:
 * redirects and route gates, navigation items, tab sets, layout switches.
 *
 * Returns `'loading'` until the answer arrives; render a loading state for that
 * branch — the chrome's own skeleton, not a guess. Callers must not collapse
 * `'loading'` into `'off'`; that is the bug this hook exists to prevent.
 *
 * ```tsx
 * const gate = useFeatureFlagGate('scripts-v2');
 * if (gate === 'loading') return <ScriptsPageSkeleton />;
 * if (gate === 'off') { redirect(); return null; }
 * ```
 */
export function useFeatureFlagGate(flagName: FeatureFlagName, envFallback?: boolean): FeatureFlagGate {
  return useFeatureFlagsStore(state => {
    if (!state.isLoaded) return 'loading';
    const enabled = flagName in state.flags ? state.flags[flagName] : (envFallback ?? false);
    return enabled ? 'on' : 'off';
  });
}

/**
 * Flag read that treats "not answered yet" as the fallback value.
 *
 * Only for places where appearing LATE is acceptable and appearing WRONGLY is
 * impossible — a card or section that is absent until the flag says otherwise,
 * and whose absence changes nothing else on the page. If the flag decides where
 * something goes, whether a route is reachable, or which of two layouts renders,
 * use `useFeatureFlagGate` instead and render a loading branch.
 *
 * `featureFlags.*.enabled()` is the same resolution as a snapshot, for imperative
 * reads (event handlers, query builders) where subscribing is pointless. Both
 * share the same caveat: before the answer they report the fallback.
 */
export function useFeatureFlag(flagName: FeatureFlagName, envFallback = false): boolean {
  return useFeatureFlagsStore(state =>
    state.isLoaded && flagName in state.flags ? state.flags[flagName] : envFallback,
  );
}
