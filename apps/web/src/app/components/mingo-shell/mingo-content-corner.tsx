'use client';

import { TimeTrackerHeaderButton } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  NotificationsBellButton,
  TicketAlertsButton,
} from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { routes } from '@/lib/routes';

/**
 * The floating face of `NotificationsBellButton variant="floating"` (36px bordered
 * square on the card colour, 20px glyph), for the header cells that move into the corner
 * with it. `data-[state=open]` keeps the time tracker's pressed look while its popover is
 * open: the opaque face would otherwise override the cell's active background.
 */
const FLOATING_CELL =
  'h-9 w-9 rounded-md border border-ods-border bg-ods-card data-[state=open]:bg-ods-bg-active [&_svg]:h-5 [&_svg]:w-5';

interface MingoContentCornerProps {
  /**
   * Whether the corner is the place for the time tracker and the ticket alerts: true
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
 * The Mingo-first shell's `contentCorner` (desktop): what the classic header carried at
 * its right end — the time tracker, the notifications bell and the Help Center ticket
 * alerts — floating at the top right of the page column, the bell where FE_PROMPT §2.1
 * puts it. The drawer the bell opens is the layout's own, inside the main column.
 */
export function MingoContentCorner({ ownsHeaderCells, disabled, onTicketAlerts }: MingoContentCornerProps) {
  return (
    <>
      {ownsHeaderCells && <TimeTrackerHeaderButton disabled={disabled} className={FLOATING_CELL} />}
      <NotificationsBellButton variant="floating" disabled={disabled} />
      {/* Attention-only: renders nothing until there are unread support replies. */}
      {ownsHeaderCells && (
        <TicketAlertsButton
          href={routes.helpCenter.tickets}
          onNavigate={onTicketAlerts}
          disabled={disabled}
          className={FLOATING_CELL}
        />
      )}
    </>
  );
}
