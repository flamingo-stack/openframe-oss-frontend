'use client';

import {
  LayoutIcon,
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
import { useClassicLayout } from '@/app/hooks/use-shell-variant';
import { getFullImageUrl } from '@/lib/image-url';
import { routes } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';
import { setMobileMenuOpen } from './mobile-menu';

/**
 * The workspace's address, as the row's mono subtitle: the tenant host (the native
 * shells learn it at login), else the page's own origin. Host only — the scheme is noise.
 */
export function tenantHostLabel(): string | undefined {
  const origin = runtimeEnv.tenantHostUrl() || (typeof window === 'undefined' ? '' : window.location.origin);
  try {
    return new URL(origin).host || undefined;
  } catch {
    return undefined;
  }
}

interface MingoAccountPopoverProps {
  /** The 56px rail: the avatar alone, the menu beside the rail. */
  collapsed: boolean;
  /** Behind the subscription lock: the pages the menu leads to are not reachable. Log out and the layout switch still are. */
  locked: boolean;
}

/**
 * The account row at the foot of the Mingo-first sidebar (`footerSlot`) and the menu it
 * opens: Settings, Help Center, the "Classic layout" opt-out and Log out (the same
 * confirm modal the Settings page opens). Also drawn at the foot of the phone drawer.
 */
export function MingoAccountPopover({ collapsed, locked }: MingoAccountPopoverProps) {
  const firstName = useAuthStore(state => state.user?.firstName);
  const lastName = useAuthStore(state => state.user?.lastName);
  const email = useAuthStore(state => state.user?.email);
  const imageUrl = useAuthStore(state => state.user?.image?.imageUrl);
  const imageHash = useAuthStore(state => state.user?.image?.hash);
  const openLogoutConfirm = useLogoutConfirmStore(state => state.open);
  const [, setClassicLayout] = useClassicLayout();

  const name = `${firstName ?? ''} ${lastName ?? ''}`.trim() || email || 'Account';
  // An item that navigates also closes the phone drawer it may sit in; a navigation to
  // the page already on screen would not move the location the drawer closes on.
  const closeDrawer = () => setMobileMenuOpen(false);

  const items: AccountPopoverEntry[] = [
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings02Icon />,
      href: routes.settings.root(),
      onSelect: closeDrawer,
      disabled: locked,
    },
    {
      id: 'help-center',
      label: 'Help Center',
      icon: <QuestionCircleIcon />,
      href: routes.helpCenter.root,
      onSelect: closeDrawer,
      disabled: locked,
    },
    { type: 'divider', id: 'divider' },
    // The per-user opt-out (`of.shell.classic`): the shell switches in place. Settings ›
    // profile carries the way back.
    { id: 'classic-layout', label: 'Classic layout', icon: <LayoutIcon />, onSelect: () => setClassicLayout(true) },
    { id: 'logout', label: 'Log out', icon: <Logout02Icon />, tone: 'danger', onSelect: openLogoutConfirm },
  ];

  return (
    <AccountPopover
      collapsed={collapsed}
      name={name}
      email={email}
      subtitle={tenantHostLabel()}
      avatarUrl={getFullImageUrl(imageUrl, imageHash) ?? null}
      items={items}
    />
  );
}
