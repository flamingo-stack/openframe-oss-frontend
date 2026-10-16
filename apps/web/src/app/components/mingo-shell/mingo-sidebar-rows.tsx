'use client';

import { PlusCircleIcon, ShieldCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { NavigationSidebarActionRow } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { usePathname } from 'next/navigation';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
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
 * "New chat" and "Needs approval", as the lib's sidebar action rows (the nav row's
 * geometry, active pill and 99+ count pill; a dot in the rail). Not nav entries — New
 * chat is an action — so they live in the slot rather than in `items`, and render in the
 * phone drawer too, where acting on one closes it (the layout closes it on a navigation,
 * which New chat on home and Needs approval on its own page are not).
 */
export function MingoSidebarRows({ minimized, disabled }: MingoSidebarRowsProps) {
  const pathname = usePathname();
  const pendingApprovals = usePendingApprovalCount();
  const onApprovals = pathname === routes.approvals || (pathname?.startsWith(`${routes.approvals}/`) ?? false);

  // "New chat": Mingo's home with a new, empty chat. Through the dock, which goes home
  // first and resets the chat there: reset here, the chat page still on screen would
  // draw the empty new chat until the navigation lands.
  const startNewChat = () => {
    useMingoLauncherStore.getState().startNewChat();
    closeMobileMenu();
  };

  return (
    <div className="mb-[var(--spacing-system-xsf)] flex flex-col gap-[var(--spacing-system-xxs)] border-b border-ods-border pb-[var(--spacing-system-xsf)]">
      <NavigationSidebarActionRow
        variant="outline"
        icon={<PlusCircleIcon />}
        label="New chat"
        minimized={minimized}
        onClick={startNewChat}
        disabled={disabled}
      />
      <NavigationSidebarActionRow
        icon={<ShieldCheckIcon />}
        label="Needs approval"
        href={routes.approvals}
        active={onApprovals}
        count={pendingApprovals}
        minimized={minimized}
        onClick={closeMobileMenu}
        disabled={disabled}
      />
    </div>
  );
}
