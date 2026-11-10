'use client';

import { TimeTrackerHeaderButton } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  ListBulletIcon,
  PlusCircleIcon,
  SidebarIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  NavigationSidebarActionRow,
  NotificationsBellButton,
} from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useNeedsYouCount } from '@/app/(app)/mingo/home/needs-you/needs-you-card';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { MingoAccountPopover } from '@/app/components/mingo-shell/mingo-account-popover';
import { MingoSidebarHistory } from '@/app/components/mingo-shell/mingo-sidebar-history';
import { closeMobileMenu } from '@/app/components/mingo-shell/mobile-menu-store';
import { useSubscriptionOpen } from '@/app/components/subscription-lock/subscription-guard';

/**
 * The Manhattan v2 shell's left sidebar (flag `manhattan-v2`, Figma "mingo (Manhattan)"
 * 1408:292998 / 1408:293116): "New Chat" over the chats, the user row at the foot.
 * Built from the Mingo-first shell's own pieces — the launcher's new chat, the chat
 * history section, the account popover, the time tracker and the bell — so every one
 * of their actions works as it does today; only the arrangement is new.
 */

/**
 * "New Chat" (Figma `start-work`, 1366:93304): Mingo's home, Start Work, where a new chat
 * starts. The same launcher action as the Mingo-first shell's "New chat" (the dock goes
 * home and resets the chat there). Its counter is how many rows Start Work's "Needs you"
 * shows, read from the same sources (no request of its own once the page has read them);
 * none while they load, behind the paywall or behind the lock screen.
 */
export function ManhattanStartWorkRow({
  minimized,
  active,
  disabled = false,
}: {
  minimized: boolean;
  active: boolean;
  /** Behind the paywall, as the Mingo-first rows are. */
  disabled?: boolean;
}) {
  const open = useSubscriptionOpen();
  const { count, sources } = useNeedsYouCount(open && !disabled);
  return (
    <>
      {sources}
      <NavigationSidebarActionRow
        size="sectioned"
        icon={<PlusCircleIcon />}
        label="New Chat"
        count={disabled ? 0 : count}
        countTone="warning"
        active={active}
        disabled={disabled}
        minimized={minimized}
        onClick={() => {
          useMingoLauncherStore.getState().startNewChat();
          closeMobileMenu();
        }}
      />
    </>
  );
}

/**
 * The chats: the history section ("Current chats", the day groups, search, ⋯, My / All)
 * from 140px of width, and in the 56px rail a list icon that expands the sidebar.
 */
export function ManhattanChatsSection({ minimized, onExpand }: { minimized: boolean; onExpand: () => void }) {
  if (minimized) {
    return (
      <NavigationSidebarActionRow
        size="sectioned"
        icon={<ListBulletIcon />}
        label="Chats"
        minimized
        onClick={onExpand}
      />
    );
  }
  return (
    // `flex-1`: the sidebar's spare height, where an empty list centres (Figma 1409:305752).
    <div className="flex flex-1 flex-col duration-300 animate-in fade-in motion-reduce:animate-none">
      <MingoSidebarHistory density="compact" />
    </div>
  );
}

interface ManhattanChatsFooterProps {
  minimized: boolean;
  /** The lock screen is up: the account keeps Log out only, the controls do nothing. */
  locked: boolean;
  /**
   * From md up the sidebar owns the time tracker and the bell (one tracker instance: its
   * popover follows a shared open state); below md the phone top bar does.
   */
  ownsHeaderCells: boolean;
  /** Not in the phone drawer, which stays mounted from md up. */
  inDrawer: boolean;
  onToggleCollapsed: () => void;
}

/** One 32px square glyph button, as the Figma footer draws them. */
const FOOTER_BUTTON_CLASS = cn(
  'flex size-8 shrink-0 items-center justify-center rounded-md text-ods-text-panel-secondary transition-colors',
  'hover:bg-ods-bg-hover hover:text-ods-text-primary active:bg-ods-bg-active',
  'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus',
);

/**
 * The user row (Figma `user`): the account (the avatar alone; its menu shows the name and
 * email over Log out — Settings and Help Center are in the navigation) with the time tracker
 * and the bell beside it, and the collapse button alone at the row's end — one 56px row,
 * everything on one centre line. In the rail a column,
 * each centred: avatar, Worktime, bell, collapse.
 */
export function ManhattanChatsFooter({
  minimized,
  locked,
  ownsHeaderCells,
  inDrawer,
  onToggleCollapsed,
}: ManhattanChatsFooterProps) {
  const controls = ownsHeaderCells && !inDrawer && (
    <>
      <TimeTrackerHeaderButton variant="compact" disabled={locked} popoverSide="right" popoverAlign="end" />
      <NotificationsBellButton variant="compact" disabled={locked} />
    </>
  );
  const collapse = !inDrawer && (
    <button
      type="button"
      className={FOOTER_BUTTON_CLASS}
      aria-label={minimized ? 'Show chats' : 'Hide chats'}
      title={minimized ? 'Show chats' : 'Hide chats'}
      onClick={onToggleCollapsed}
    >
      <SidebarIcon size={20} />
    </button>
  );
  return (
    <div
      className={cn(
        // The lib's compact cells are row cells in the rail (left-aligned glyph): centred here.
        'flex items-center [&_button]:justify-center',
        minimized
          ? 'flex-col gap-[var(--spacing-system-xxs)] py-[var(--spacing-system-sf)] [&_button]:px-0'
          : 'h-14 gap-[var(--spacing-system-xsf)] pl-[var(--spacing-system-xsf)] pr-[var(--spacing-system-xsf)]',
      )}
    >
      {/* The avatar with the time tracker and the bell beside it; the collapse button alone at
          the row's end. The rail stacks them all, centred: avatar, Worktime, bell, collapse. */}
      <div
        className={cn(
          'flex min-w-0 items-center',
          minimized ? 'w-full flex-col gap-[var(--spacing-system-xxs)]' : 'flex-1 gap-[var(--spacing-system-xsf)]',
        )}
      >
        <div className={cn('shrink-0', minimized && 'w-full')}>
          <MingoAccountPopover collapsed={minimized} locked={locked} collapsedAlign="center" avatarOnly logoutOnly />
        </div>
        {controls}
      </div>
      {collapse && <div className={cn('flex shrink-0 items-center', minimized && 'w-full flex-col')}>{collapse}</div>}
    </div>
  );
}
