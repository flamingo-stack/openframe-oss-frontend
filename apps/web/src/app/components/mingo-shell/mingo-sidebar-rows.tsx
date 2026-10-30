'use client';

import { ChartDonutIcon, ShieldCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { NavigationSidebarActionRow } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { usePathname } from 'next/navigation';
import { routes } from '@/lib/routes';
import { closeMobileMenu } from './mobile-menu-store';
import { usePendingApprovalCount } from './use-pending-approval-count';

interface MingoSidebarRowsProps {
  /** The 56px rail: the rows' tooltips (their geometry follows the rail's width on its own). */
  minimized: boolean;
  /** Behind the subscription lock (or before the session): nothing here leads anywhere. */
  disabled: boolean;
}

/**
 * The Mingo rows on top of the Mingo-first sidebar (`topSlot`), above the module tree:
 * "Dashboard" and "Needs approval", as the lib's sidebar action rows (the nav row's
 * geometry, active pill and 99+ count pill; a dot in the rail). They live in the slot
 * rather than in `items`, and render in the phone drawer too, where a click closes it
 * (the layout closes it on a navigation, which a row on its own page is not). "New chat"
 * heads the chats instead (`MingoNewChatRow`, over the chat history).
 */
export function MingoSidebarRows({ minimized, disabled }: MingoSidebarRowsProps) {
  const pathname = usePathname();
  const pendingApprovals = usePendingApprovalCount();
  const on = (path: string) => pathname === path || (pathname?.startsWith(`${path}/`) ?? false);

  return (
    <div className="mb-[var(--spacing-system-xsf)] flex flex-col gap-[var(--spacing-system-xxs)] border-b border-ods-border pb-[var(--spacing-system-xsf)]">
      <NavigationSidebarActionRow
        icon={<ChartDonutIcon />}
        label="Dashboard"
        href={routes.dashboard}
        active={on(routes.dashboard)}
        minimized={minimized}
        onClick={closeMobileMenu}
        disabled={disabled}
      />
      <NavigationSidebarActionRow
        icon={<ShieldCheckIcon />}
        label="Needs approval"
        href={routes.approvals}
        active={on(routes.approvals)}
        count={pendingApprovals}
        minimized={minimized}
        onClick={closeMobileMenu}
        disabled={disabled}
      />
    </div>
  );
}
