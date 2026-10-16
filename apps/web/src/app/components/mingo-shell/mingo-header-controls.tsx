'use client';

import { TimeTrackerHeaderButton } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  NotificationsBellButton,
  TicketAlertsButton,
} from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { routes } from '@/lib/routes';

interface MingoHeaderControlsProps {
  /** The sidebar's 56px rail: the controls stack under the logo mark, so the tracker's panel opens to the right. */
  minimized: boolean;
  /**
   * Whether the sidebar is the place for the time tracker and the ticket alerts: true
   * from md up, where the phone top bar that otherwise carries them is not drawn. Only
   * `true` mounts them — the time tracker's popover follows a shared open state, so a
   * second, hidden instance in the top bar would open a second panel.
   */
  ownsHeaderCells: boolean;
  /** The lock screen is up: the controls stay visible and do nothing, as the header's did. */
  disabled: boolean;
  /** Receives the full Help Center ticket href the alerts cell builds (newest unread ticket). */
  onTicketAlerts: (href: string) => void;
}

/**
 * The Mingo-first shell's sidebar header controls (`NavigationSidebarConfig.headerSlot`,
 * desktop): what the classic header carried at its right end — the time tracker, the
 * notifications bell and the Help Center ticket alerts — as the lib's 32px compact
 * buttons beside the logo (stacked under the mark in the rail). They used to float in
 * the page column's corner, over every page's title row and the chat header's ⋯. The
 * drawer the bell opens is the layout's own, inside the main column. Below md the phone
 * top bar keeps them; the sidebar header is not drawn in the burger drawer.
 */
export function MingoHeaderControls({
  minimized,
  ownsHeaderCells,
  disabled,
  onTicketAlerts,
}: MingoHeaderControlsProps) {
  return (
    <>
      {ownsHeaderCells && (
        <TimeTrackerHeaderButton variant="compact" disabled={disabled} popoverSide={minimized ? 'right' : 'bottom'} />
      )}
      <NotificationsBellButton variant="compact" disabled={disabled} />
      {/* Attention-only: renders nothing until there are unread support replies. */}
      {ownsHeaderCells && (
        <TicketAlertsButton
          variant="compact"
          href={routes.helpCenter.tickets}
          onNavigate={onTicketAlerts}
          disabled={disabled}
        />
      )}
    </>
  );
}
