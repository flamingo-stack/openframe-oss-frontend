'use client';

import {
  Logout02Icon,
  QuestionCircleIcon,
  Settings02Icon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  AccountPopover,
  type AccountPopoverEntry,
} from '@flamingo-stack/openframe-frontend-core/components/navigation';
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
 * opens). The "Classic layout" opt-out is in Settings › profile only. Also drawn at the
 * foot of the phone drawer.
 */
export function MingoAccountPopover({ collapsed, locked }: MingoAccountPopoverProps) {
  const firstName = useAuthStore(state => state.user?.firstName);
  const lastName = useAuthStore(state => state.user?.lastName);
  const email = useAuthStore(state => state.user?.email);
  const imageUrl = useAuthStore(state => state.user?.image?.imageUrl);
  const imageHash = useAuthStore(state => state.user?.image?.hash);
  const openLogoutConfirm = useLogoutConfirmStore(state => state.open);

  const name = `${firstName ?? ''} ${lastName ?? ''}`.trim() || email || 'Account';

  // An item that navigates also closes the phone drawer it may sit in: a navigation to
  // the page already on screen does not move the location the layout closes it on.
  const items: AccountPopoverEntry[] = [
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
