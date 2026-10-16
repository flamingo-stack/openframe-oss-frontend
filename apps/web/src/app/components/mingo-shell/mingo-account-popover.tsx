'use client';

import {
  LifeBuoyIcon,
  Logout02Icon,
  QuestionCircleIcon,
  Settings02Icon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  AccountPopover,
  type AccountPopoverEntry,
} from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { buildTicketOpenHref, useOptionalTicketLive } from '@flamingo-stack/openframe-frontend-core/components/tickets';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useLogoutConfirmStore } from '@/app/(auth)/auth/stores/logout-confirm-store';
import { getFullImageUrl } from '@/lib/image-url';
import { routes } from '@/lib/routes';
import { closeMobileMenu } from './mobile-menu-store';

interface MingoAccountPopoverProps {
  /** The 56px rail: the avatar alone, the menu beside the rail. */
  collapsed: boolean;
  /** Behind the subscription lock: the pages the menu leads to are not reachable. Log out and the layout switch still are. */
  locked: boolean;
}

/**
 * The account row at the foot of the Mingo-first sidebar (`footerSlot`) — the avatar and
 * the name, no workspace host — and the menu it opens: Settings, Help Center and Log out (the same confirm modal the Settings page
 * opens). Unread support replies add "Support replies" with their count, opening the
 * ticket with the newest one (as the classic header's ticket alerts cell did), and the
 * unread dot on the avatar. The "Classic layout" opt-out is in Settings › profile only. Also drawn at the
 * foot of the phone drawer.
 */
export function MingoAccountPopover({ collapsed, locked }: MingoAccountPopoverProps) {
  const firstName = useAuthStore(state => state.user?.firstName);
  const lastName = useAuthStore(state => state.user?.lastName);
  const email = useAuthStore(state => state.user?.email);
  const imageUrl = useAuthStore(state => state.user?.image?.imageUrl);
  const imageHash = useAuthStore(state => state.user?.image?.hash);
  const openLogoutConfirm = useLogoutConfirmStore(state => state.open);
  const ticketLive = useOptionalTicketLive();
  const unreadReplies = ticketLive?.authed ? ticketLive.unreadTotal : 0;

  const name = `${firstName ?? ''} ${lastName ?? ''}`.trim() || email || 'Account';

  // An item that navigates also closes the phone drawer it may sit in: a navigation to
  // the page already on screen does not move the location the layout closes it on.
  const items: AccountPopoverEntry[] = [
    ...(unreadReplies > 0
      ? [
          {
            id: 'support-replies',
            label: 'Support replies',
            icon: <LifeBuoyIcon />,
            href: ticketLive?.nextUnreadTicketId
              ? buildTicketOpenHref(routes.helpCenter.tickets, ticketLive.nextUnreadTicketId)
              : routes.helpCenter.tickets,
            count: unreadReplies,
            onSelect: closeMobileMenu,
            disabled: locked,
          },
        ]
      : []),
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings02Icon />,
      href: routes.settings.root(),
      onSelect: closeMobileMenu,
      disabled: locked,
    },
    {
      id: 'help-center',
      label: 'Help Center',
      icon: <QuestionCircleIcon />,
      href: routes.helpCenter.root,
      onSelect: closeMobileMenu,
      disabled: locked,
    },
    { type: 'divider', id: 'divider' },
    { id: 'logout', label: 'Log out', icon: <Logout02Icon />, tone: 'danger', onSelect: openLogoutConfirm },
  ];

  return (
    <AccountPopover
      collapsed={collapsed}
      name={name}
      email={email}
      avatarUrl={getFullImageUrl(imageUrl, imageHash) ?? null}
      items={items}
    />
  );
}
