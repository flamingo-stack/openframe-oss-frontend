'use client';

import { PlusCircleIcon, ShieldCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { NavigationSidebarActionRow } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { usePathname, useRouter } from 'next/navigation';
import { useMingoChat } from '@/app/(app)/mingo/providers/mingo-chat-provider';
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
  const router = useRouter();
  const pathname = usePathname();
  const { chat } = useMingoChat();
  const pendingApprovals = usePendingApprovalCount();
  const onApprovals = pathname === routes.approvals || (pathname?.startsWith(`${routes.approvals}/`) ?? false);

  // "New chat": the composer stops continuing the chat selected in the sidebar (the
  // dock's continue-vs-new rule) and the user lands on Mingo's home with it empty.
  const startNewChat = () => {
    void chat?.state.startNewDialog();
    closeMobileMenu();
    router.push(routes.mingo.home);
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
