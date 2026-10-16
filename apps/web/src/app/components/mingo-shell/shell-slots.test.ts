import { describe, expect, it } from 'vitest';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import type { ShellVariant } from '@/lib/shell-variant';
import { resolveShellSlots, type ShellSlotPlan } from './shell-slots';

const VARIANTS: ShellVariant[] = ['loading', 'classic', 'mingo'];
const GATES: FeatureFlagGate[] = ['loading', 'on', 'off'];

/** Every combination the shell can be asked about. */
const MATRIX = VARIANTS.flatMap(variant =>
  GATES.flatMap(v2ChatGate =>
    [true, false].flatMap(chatMounted => [true, false].map(locked => ({ variant, v2ChatGate, chatMounted, locked }))),
  ),
);

/** The slots nothing but the classic shell may fill, and the ones nothing but the Mingo-first shell may. */
const CLASSIC_ONLY = ['chatDrawer', 'chatSidePanel', 'dialogUrlSync'] as const satisfies ReadonlyArray<
  keyof ShellSlotPlan
>;
const MINGO_ONLY = ['sidebarControls', 'mobileMingoCells', 'historySearchShortcut'] as const satisfies ReadonlyArray<
  keyof ShellSlotPlan
>;

describe('resolveShellSlots', () => {
  it('fills the classic shell exactly as before: header, flat sidebar, drawer or side panel by mingo-v2', () => {
    const base = { variant: 'classic', chatMounted: true, locked: false } as const;
    expect(resolveShellSlots({ ...base, v2ChatGate: 'off' })).toEqual({
      sidebar: 'flat',
      desktopHeader: true,
      sidebarControls: false,
      chatDrawer: true,
      chatSidePanel: false,
      composerDock: 'absent',
      dialogUrlSync: true,
      mobileMingoCells: false,
      historySearchShortcut: false,
    });
    expect(resolveShellSlots({ ...base, v2ChatGate: 'on' })).toMatchObject({ chatDrawer: false, chatSidePanel: true });
    // No session yet, or the paywall: neither chat surface, the URL sync still owns the param (it holds it).
    expect(resolveShellSlots({ ...base, v2ChatGate: 'on', chatMounted: false })).toMatchObject({
      chatDrawer: false,
      chatSidePanel: false,
      dialogUrlSync: true,
    });
  });

  it('draws the Mingo-first shell: grouped sidebar, no desktop header, bell in the corner, the dock', () => {
    expect(resolveShellSlots({ variant: 'mingo', v2ChatGate: 'on', chatMounted: true, locked: false })).toEqual({
      sidebar: 'grouped',
      desktopHeader: false,
      sidebarControls: true,
      chatDrawer: false,
      chatSidePanel: false,
      composerDock: 'dock',
      dialogUrlSync: false,
      mobileMingoCells: true,
      historySearchShortcut: true,
    });
  });

  it('keeps the dock slot, empty, behind the paywall', () => {
    expect(
      resolveShellSlots({ variant: 'mingo', v2ChatGate: 'on', chatMounted: false, locked: true }).composerDock,
    ).toBe('empty');
  });

  it('decides nothing while the variant is loading: the classic sidebar placeholder, no Mingo surface, no param owner', () => {
    for (const plan of MATRIX.filter(input => input.variant === 'loading').map(resolveShellSlots)) {
      expect(plan).toEqual({
        sidebar: 'flat',
        desktopHeader: true,
        sidebarControls: false,
        chatDrawer: false,
        chatSidePanel: false,
        composerDock: 'absent',
        dialogUrlSync: false,
        mobileMingoCells: false,
        historySearchShortcut: false,
      });
    }
  });

  it('never mixes the two shells, whatever the inputs', () => {
    for (const input of MATRIX) {
      const plan = resolveShellSlots(input);
      const context = JSON.stringify(input);
      for (const slot of CLASSIC_ONLY)
        expect(plan[slot] && input.variant !== 'classic', `${context} ${slot}`).toBe(false);
      for (const slot of MINGO_ONLY) expect(plan[slot], `${context} ${slot}`).toBe(input.variant === 'mingo');
      expect(plan.composerDock !== 'absent', context).toBe(input.variant === 'mingo');
      expect(plan.sidebar === 'grouped', context).toBe(input.variant === 'mingo');
      expect(plan.desktopHeader, context).toBe(input.variant !== 'mingo');
      expect(plan.chatDrawer && plan.chatSidePanel, context).toBe(false);
    }
  });
});
