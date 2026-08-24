'use client';

import { ActionsMenuDropdown, type ActionsMenuGroup, Button } from '@flamingo-stack/openframe-frontend-core';
import { OpenFrameLogo } from '@flamingo-stack/openframe-frontend-core/components/icons';
import {
  Chevron02DownIcon,
  Collapse02Icon,
  Ellipsis01Icon,
  MonitorIcon,
  Settings01Icon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';

interface FullscreenToolbarProps {
  deviceName: string;
  displayMenuGroups: ActionsMenuGroup[];
  currentDisplayLabel: string;
  actionsMenuGroups: ActionsMenuGroup[];
  onOpenSettings: () => void;
  onExitFullscreen: () => void;
}

/**
 * Compact overlay chrome for the fullscreen remote-desktop mode (Figma 1-70992):
 * a floating semi-transparent bar at top-center (device name, display switcher,
 * actions / exit-fullscreen / settings) plus a dimmed OpenFrame logo in the
 * top-left corner of the stream. Rendered inside the fullscreen container,
 * absolutely positioned over the canvas.
 */
export function FullscreenToolbar({
  deviceName,
  displayMenuGroups,
  currentDisplayLabel,
  actionsMenuGroups,
  onOpenSettings,
  onExitFullscreen,
}: FullscreenToolbarProps) {
  return (
    <>
      <OpenFrameLogo className="absolute left-[var(--spacing-system-mf)] top-[var(--spacing-system-mf)] z-10 h-6 w-6 opacity-50" />
      <div
        className={
          'absolute top-0 left-1/2 z-10 -translate-x-1/2 w-[calc(100%-7rem)] ' +
          'flex items-center gap-[var(--spacing-system-xs)] ' +
          'rounded-b-[6px] border-x border-b border-ods-border bg-ods-overlay ' +
          'py-[var(--spacing-system-xsf)] pl-[var(--spacing-system-mf)] pr-[var(--spacing-system-xsf)]'
        }
      >
        <div className="flex flex-1 min-w-0 items-center gap-[var(--spacing-system-xsf)]">
          <span className="truncate text-h6 text-ods-text-primary">{deviceName}</span>
          {displayMenuGroups.length > 0 && (
            <ActionsMenuDropdown
              groups={displayMenuGroups}
              customTrigger={
                <button
                  type="button"
                  aria-label="Switch display"
                  className={
                    'flex h-8 flex-shrink-0 items-center gap-[var(--spacing-system-xs)] rounded-[6px] ' +
                    'border border-ods-border bg-ods-card p-[var(--spacing-system-xsf)] ' +
                    'text-ods-text-primary hover:border-ods-border-hover'
                  }
                >
                  <MonitorIcon className="h-4 w-4" />
                  <span className="text-h5 whitespace-nowrap">{currentDisplayLabel}</span>
                  <Chevron02DownIcon className="h-4 w-4" />
                </button>
              }
            />
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-[var(--spacing-system-xs)]">
          <ActionsMenuDropdown
            groups={actionsMenuGroups}
            customTrigger={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Actions"
                leftIcon={<Ellipsis01Icon className="h-4 w-4" />}
              />
            }
          />
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Exit fullscreen"
            onClick={onExitFullscreen}
            leftIcon={<Collapse02Icon className="h-4 w-4" />}
          />
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Settings"
            onClick={onOpenSettings}
            leftIcon={<Settings01Icon className="h-4 w-4" />}
          />
        </div>
      </div>
    </>
  );
}
