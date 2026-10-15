'use client';

import { PlusCircleIcon, ShieldCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { UnreadCountBadge } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMingoChat } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { routes } from '@/lib/routes';
import { setMobileMenuOpen } from './mobile-menu';
import { usePendingApprovalCount } from './use-pending-approval-count';

/**
 * The rows' geometry, matched to the grouped sidebar's own (44px rows with an 8px inset
 * and an h4 label; a centred 40px cell in the 56px rail). `md:h-*` restated because the
 * lib Button grows to 48px from md.
 */
const ROW_EXPANDED = 'h-11 w-full justify-start px-[var(--spacing-system-xsf)] md:h-11';
const ROW_RAIL = 'h-10 w-10 justify-center px-0 md:h-10';
/** The grouped sidebar's active pill (`ACTIVE_PILL` in the lib: Figma `yellow sec`, no ODS token yet). */
const ACTIVE_PILL = 'bg-ods-accent-secondary text-ods-accent hover:bg-ods-accent-secondary';

interface MingoSidebarRowsProps {
  /** The 56px rail: icons only. */
  minimized: boolean;
  /** Behind the subscription lock (or before the session): nothing here leads anywhere. */
  disabled: boolean;
}

/**
 * The Mingo rows on top of the Mingo-first sidebar (`topSlot`), above the module tree:
 * "New chat" and "Needs approval". Not nav entries — New chat is an action — so they
 * live in the slot rather than in `items`, and render in the mobile burger drawer too.
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
    setMobileMenuOpen(false);
    router.push(routes.mingo.home);
  };

  const approvalsContent = (
    <>
      <span className="relative inline-flex shrink-0">
        <ShieldCheckIcon className={onApprovals && !disabled ? 'text-ods-accent' : 'text-ods-text-secondary'} />
        {minimized && <UnreadCountBadge count={pendingApprovals} />}
      </span>
      {!minimized && (
        <>
          <span className="min-w-0 flex-1 truncate text-left">Needs approval</span>
          <UnreadCountBadge count={pendingApprovals} className="static shrink-0" />
        </>
      )}
    </>
  );
  const approvalsLabel = pendingApprovals > 0 ? `Needs approval (${pendingApprovals} waiting)` : 'Needs approval';

  return (
    <div
      className={cn(
        'mb-[var(--spacing-system-xsf)] flex flex-col gap-[var(--spacing-system-xxs)] border-b border-ods-border pb-[var(--spacing-system-xsf)]',
        minimized && 'items-center',
      )}
    >
      <Button
        type="button"
        variant="outline"
        font="regular"
        onClick={startNewChat}
        disabled={disabled}
        aria-label={minimized ? 'New chat' : undefined}
        title={minimized ? 'New chat' : undefined}
        className={minimized ? ROW_RAIL : ROW_EXPANDED}
      >
        <PlusCircleIcon className="text-ods-accent" />
        {!minimized && <span className="min-w-0 truncate">New chat</span>}
      </Button>

      {/* `asChild` over a real link (prefetch, open-in-new-tab): the Button's own `href`
          branch would drop `aria-current` and the rail's `title`. */}
      <Button
        asChild={!disabled}
        variant="transparent"
        font="regular"
        disabled={disabled}
        aria-label={approvalsLabel}
        aria-current={onApprovals && !disabled ? 'page' : undefined}
        title={minimized ? approvalsLabel : undefined}
        className={cn(minimized ? ROW_RAIL : ROW_EXPANDED, onApprovals && !disabled && ACTIVE_PILL)}
      >
        {disabled ? (
          approvalsContent
        ) : (
          <Link href={routes.approvals} onClick={() => setMobileMenuOpen(false)}>
            {approvalsContent}
          </Link>
        )}
      </Button>
    </div>
  );
}
