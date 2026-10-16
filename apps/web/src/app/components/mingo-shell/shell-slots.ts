import type { FeatureFlagGate } from '@/lib/feature-flags';
import type { ShellVariant } from '@/lib/shell-variant';

/**
 * Which slots of the ONE `CoreAppLayout` the shell fills, per shell variant.
 *
 * The layout element never changes with the variant — swapping it remounts the page
 * (`app-layout.tsx`, the provider note above `CoreAppLayout`) — so the variant is
 * expressed entirely as slot values. Pure, so the whole matrix is pinned by a test
 * instead of being read out of JSX.
 */
export interface ShellSlotPlan {
  /**
   * The sidebar: the classic flat list or the Figma groups. `'loading'` draws the
   * classic one's placeholder rows (the shape most tenants settle on); its rows are
   * placeholders either way until the chrome has its answers.
   */
  sidebar: 'flat' | 'grouped';
  /** `AppLayout.desktopHeader`. Off in the Mingo-first shell: the bell moves to the sidebar header. */
  desktopHeader: boolean;
  /**
   * The bell, time tracker and Help Center ticket alerts in the sidebar header beside
   * the logo (`NavigationSidebarConfig.headerSlot`, desktop; the phone top bar keeps them).
   */
  sidebarHeaderControls: boolean;
  /** The classic overlay chat drawer (`mingo-v2` off). */
  chatDrawer: boolean;
  /** The classic docked chat side panel (`mingo-v2` on). */
  chatSidePanel: boolean;
  /**
   * `AppLayout.composerDock`: `'absent'` (classic, loading — no slot), `'empty'` (the
   * slot kept with nothing in it, behind the paywall, so the page does not re-lay out
   * when the lock lands) or `'dock'`.
   */
  composerDock: 'absent' | 'empty' | 'dock';
  /** `useMingoDialogUrlSync` — the `?mingoDialog=` owner of the classic shell (the bridge owns it in the other). */
  dialogUrlSync: boolean;
  /** The phone top bar's Chat history cell, and its Mingo cell going home instead of toggling a drawer. */
  mobileMingoCells: boolean;
  /** ⌘K / Ctrl+K opens the sidebar's chat-history search. The classic header's Mingo button keeps its own. */
  historySearchShortcut: boolean;
}

export interface ShellSlotInputs {
  variant: ShellVariant;
  /** The v2 chat look (`useMingoV2ChatGate()`); in the classic shell it is `mingo-v2` itself. */
  v2ChatGate: FeatureFlagGate;
  /** A signed-in session on an unlocked workspace: the chat surfaces may mount. */
  chatMounted: boolean;
  /** The subscription lock holds this workspace (route-blind, unlike the lock SCREEN). */
  locked: boolean;
}

export function resolveShellSlots({ variant, v2ChatGate, chatMounted, locked }: ShellSlotInputs): ShellSlotPlan {
  const mingo = variant === 'mingo';
  const classic = variant === 'classic';
  return {
    sidebar: mingo ? 'grouped' : 'flat',
    desktopHeader: !mingo,
    sidebarHeaderControls: mingo,
    // While the variant is `'loading'` neither chat surface is drawn: which one it would
    // be is exactly what has not been answered yet, and a wrong first answer mounts one
    // surface and then swaps it out.
    chatDrawer: classic && chatMounted && v2ChatGate === 'off',
    chatSidePanel: classic && chatMounted && v2ChatGate === 'on',
    composerDock: mingo ? (locked ? 'empty' : 'dock') : 'absent',
    dialogUrlSync: classic,
    mobileMingoCells: mingo,
    historySearchShortcut: mingo,
  };
}
