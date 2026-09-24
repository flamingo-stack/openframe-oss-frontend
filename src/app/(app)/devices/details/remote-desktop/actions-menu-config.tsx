import type { ActionsMenuGroup } from '@flamingo-stack/openframe-frontend-core';
import {
  KeyboardIcon,
  MoonIcon,
  PowerIcon,
  Refresh01LeftIcon,
  Settings01Icon,
  SunriseIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { comboLabel, type RemoteShortcut } from './remote-shortcuts';

export interface ActionHandlers {
  sendShortcut: (combo: string) => void;
  openShortcutsManager: () => void;
  sendPower: (action: 'wake' | 'sleep' | 'reset' | 'poweroff') => void;
  setEnableInput: (enabled: boolean) => void;
  setClipboardEnabled: (enabled: boolean) => void;
  toast: (options: {
    title: string;
    description: string;
    variant: 'success' | 'info' | 'destructive';
    duration?: number;
  }) => void;
}

export const createActionsMenuGroups = (
  handlers: ActionHandlers,
  enableInput: boolean,
  clipboardEnabled: boolean,
  shortcuts: RemoteShortcut[],
): ActionsMenuGroup[] => [
  {
    items: [
      {
        id: 'apply-shortcut',
        label: 'Apply Shortcut',
        icon: <KeyboardIcon className="h-6 w-6" />,
        type: 'submenu',
        submenu: [
          {
            id: 'manage-shortcuts',
            label: 'Manage Shortcuts',
            icon: <Settings01Icon className="h-6 w-6" />,
            onClick: () => {
              handlers.openShortcutsManager();
            },
          },
          ...shortcuts.map(shortcut => ({
            id: shortcut.id,
            label: comboLabel(shortcut.combo),
            onClick: () => {
              handlers.sendShortcut(shortcut.combo);
            },
          })),
        ],
      },
    ],
    separator: true,
  },
  {
    items: [
      {
        id: 'wake-up',
        label: 'Wake up',
        icon: <SunriseIcon className="h-6 w-6" />,
        onClick: () => {
          handlers.sendPower('wake');
        },
      },
      {
        id: 'sleep',
        label: 'Sleep',
        icon: <MoonIcon className="h-6 w-6" />,
        onClick: () => {
          handlers.sendPower('sleep');
        },
      },
      {
        id: 'reboot',
        label: 'Reboot',
        icon: <Refresh01LeftIcon className="h-6 w-6" />,
        onClick: () => {
          handlers.sendPower('reset');
        },
      },
      {
        id: 'shut-down',
        label: 'Shut Down',
        icon: <PowerIcon className="h-6 w-6" />,
        onClick: () => {
          handlers.sendPower('poweroff');
        },
      },
    ],
    separator: true,
  },
  {
    items: [
      {
        id: 'enable-input',
        label: 'Enable Input',
        type: 'checkbox',
        checked: enableInput,
        onClick: () => {
          handlers.setEnableInput(!enableInput);
        },
      },
      {
        id: 'clipboard-sharing',
        label: 'Clipboard Sharing',
        type: 'checkbox',
        checked: clipboardEnabled,
        onClick: () => {
          handlers.setClipboardEnabled(!clipboardEnabled);
        },
      },
    ],
  },
];
