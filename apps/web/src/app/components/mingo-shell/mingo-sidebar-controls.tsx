'use client';

import { TimeTrackerHeaderButton } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  NotificationsBellButton,
  TicketAlertsButton,
} from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { routes } from '@/lib/routes';

interface MingoSidebarControlsProps {
  /**
   * Whether the sidebar is the place for these controls: true from md up, where the
   * phone top bar that otherwise carries them is not drawn. Only `true` mounts them —
   * the time tracker's popover follows a shared open state, so a second instance (the
   * top bar's) would open a second panel. The phone drawer's copy of the footer
   * (`inDrawer`) must not mount them either.
   */
  ownsHeaderCells: boolean;
  /** The lock screen is up: the rows stay visible and do nothing, as the header's cells did. */
  disabled: boolean;
  /** Receives the full Help Center ticket href the alerts row builds (newest unread ticket). */
  onTicketAlerts: (href: string) => void;
}

/**
 * The Mingo-first shell's controls at the foot of the sidebar (`footerSlot`, beside the
 * account row, desktop): what the classic header carried at its right end — the time
 * tracker, the notifications bell and the Help Center ticket alerts — as the lib's 32px
 * compact buttons. One row with the account, so they take none of the history's height;
 * stacked over the avatar in the 56px rail, as cells like the tree's rows. The drawer the bell opens is the layout's
 * own, inside the main column; the tracker's panel opens beside the sidebar.
 */
export function MingoSidebarControls({ ownsHeaderCells, disabled, onTicketAlerts }: MingoSidebarControlsProps) {
  if (!ownsHeaderCells) return null;
  return (
    // The rail's width in the rail, where each button is a row's cell; beside the account from 140px.
    <div className="flex w-full shrink-0 flex-col gap-[var(--spacing-system-xxs)] @[140px]/of-nav-sidebar:w-auto @[140px]/of-nav-sidebar:flex-row @[140px]/of-nav-sidebar:items-center">
      <TimeTrackerHeaderButton variant="compact" disabled={disabled} popoverSide="right" popoverAlign="end" />
      <NotificationsBellButton variant="compact" disabled={disabled} />
      {/* Attention-only: renders nothing until there are unread support replies. */}
      <TicketAlertsButton
        variant="compact"
        href={routes.helpCenter.tickets}
        onNavigate={onTicketAlerts}
        disabled={disabled}
      />
    </div>
  );
}
