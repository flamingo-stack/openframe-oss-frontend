import {
  Link01BreakIcon,
  PauseIcon,
  PenEditIcon,
  PlayIcon,
  Refresh02VrIcon,
  TrashIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ActionsMenuGroup, PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { routes } from '@/lib/routes';

const MENU_ICON_CLASS = 'h-6 w-6 text-ods-text-secondary';

export function reconnectAction(id: string): PageActionButton {
  return {
    label: 'Reconnect',
    icon: <Refresh02VrIcon className="h-5 w-5 text-ods-text-secondary" />,
    variant: 'outline',
    href: routes.cloudTenantManagement.reconnect(id),
  };
}

export function editAction(id: string): PageActionButton {
  return {
    label: 'Edit Integration',
    icon: <PenEditIcon className="h-5 w-5 text-ods-text-secondary" />,
    variant: 'outline',
    href: routes.cloudTenantManagement.edit(id),
  };
}

const deleteGroup = (id: string): ActionsMenuGroup => ({
  items: [
    {
      id: 'delete',
      label: 'Delete connection',
      icon: <TrashIcon className="h-6 w-6" />,
      danger: true,
      href: routes.cloudTenantManagement.delete(id),
    },
  ],
});

const reconnectItem = (id: string) => ({
  id: 'reconnect',
  label: 'Reconnect',
  icon: <Refresh02VrIcon className={MENU_ICON_CLASS} />,
  href: routes.cloudTenantManagement.reconnect(id),
});

interface TenantMenuOptions {
  id: string;
  /** The last probe read the directory: there is a connection to pause or to end. */
  readable: boolean;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  /** A pause or a resume is in flight. */
  busy: boolean;
}

/**
 * The "…" menu of the details page. A tenant that can be read: Pause or Resume, Disconnect, and Delete apart (Figma
 * 3469-49200, 3226-2439), plus Reconnect, the way to grant what a partial consent left out, which the alert under the
 * card points at. One that cannot: Reconnect and Delete (3226-2347).
 */
export function tenantMenuGroups({
  id,
  readable,
  paused,
  onPause,
  onResume,
  busy,
}: TenantMenuOptions): ActionsMenuGroup[] {
  if (!readable) return [{ items: [reconnectItem(id)], separator: true }, deleteGroup(id)];
  return [
    {
      items: [
        paused
          ? {
              id: 'resume',
              label: 'Resume Sync',
              icon: <PlayIcon className={MENU_ICON_CLASS} />,
              onClick: onResume,
              disabled: busy,
            }
          : {
              id: 'pause',
              label: 'Pause Sync',
              icon: <PauseIcon className={MENU_ICON_CLASS} />,
              onClick: onPause,
              disabled: busy,
            },
        reconnectItem(id),
        {
          id: 'disconnect',
          label: 'Disconnect',
          icon: <Link01BreakIcon className={MENU_ICON_CLASS} />,
          href: routes.cloudTenantManagement.disconnect(id),
        },
      ],
      separator: true,
    },
    deleteGroup(id),
  ];
}
