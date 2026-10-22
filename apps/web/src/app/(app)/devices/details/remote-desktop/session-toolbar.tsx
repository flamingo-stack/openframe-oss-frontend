'use client';

import { ActionsMenuDropdown, type ActionsMenuGroup, Button } from '@flamingo-stack/openframe-frontend-core';
import {
  OpenframeLogoIcon,
  ChatBlankIcon,
  Chevron02DownIcon,
  Collapse02Icon,
  Ellipsis01Icon,
  Expand02Icon,
  MonitorIcon,
  Settings01Icon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { UnreadDot } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

interface SessionToolbarProps {
  deviceName: string;
  displayMenuGroups: ActionsMenuGroup[];
  currentDisplayLabel: string;
  actionsMenuGroups: ActionsMenuGroup[];
  onOpenSettings: () => void;
  /** In fullscreen the toolbar carries the dimmed logo and an exit button; windowed, an enter button. */
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  /** Session chat toggle - omitted when the session has no chat. */
  chatOpen?: boolean;
  /** The end user wrote while the chat was closed: a dot on the toggle. */
  chatUnread?: boolean;
  onToggleChat?: () => void;
  /**
   * Auto-hide: slid out of view when false. The bar stays in the DOM so a Tab
   * into it still works - `hold('focus', true)` then brings it back.
   */
  visible?: boolean;
  /** Keeps the bar up while something is interacting with it (see `useAutoHideToolbar`). */
  hold?: (key: string, held: boolean) => void;
}

/**
 * Compact overlay chrome over the remote-desktop stream (Figma 1755-95622, drawn
 * for fullscreen): a floating semi-transparent bar at top-center (device name,
 * display switcher, actions / chat / fullscreen / settings as 32px icon
 * buttons) plus, in fullscreen, a dimmed OpenFrame logo in the top-left corner.
 * Rendered inside the stream container, absolutely positioned over the canvas.
 * Windowed, the same bar replaces the pinned header card when the user turns on
 * "Auto-hide toolbar", so the stream gets the full height.
 */
export function SessionToolbar({
  deviceName,
  displayMenuGroups,
  currentDisplayLabel,
  actionsMenuGroups,
  onOpenSettings,
  fullscreen,
  onToggleFullscreen,
  chatOpen = false,
  chatUnread = false,
  onToggleChat,
  visible = true,
  hold,
}: SessionToolbarProps) {
  return (
    <>
      {fullscreen && (
        <OpenframeLogoIcon
          color="var(--color-text-on-accent)"
          secondaryColor="var(--color-text-primary)"
          className="absolute left-[var(--spacing-system-mf)] top-[var(--spacing-system-mf)] z-10 h-6 w-6 opacity-50"
        />
      )}
      <div
        data-state={visible ? 'visible' : 'hidden'}
        className={cn(
          'absolute left-1/2 top-0 z-10 w-[calc(100%-7rem)] -translate-x-1/2',
          'flex items-center gap-[var(--spacing-system-xs)]',
          'rounded-b-[6px] border-x border-b border-ods-border bg-ods-overlay',
          'py-[var(--spacing-system-xsf)] pl-[var(--spacing-system-mf)] pr-[var(--spacing-system-xsf)]',
          'transition-[transform,opacity] duration-200 motion-reduce:transition-none',
          !visible && 'pointer-events-none -translate-y-full opacity-0',
        )}
        onPointerEnter={() => hold?.('hover', true)}
        onPointerLeave={() => hold?.('hover', false)}
        onFocus={() => hold?.('focus', true)}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) hold?.('focus', false);
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]">
          <span className="truncate text-ods-text-primary text-h6">{deviceName}</span>
          {displayMenuGroups.length > 0 && (
            <ActionsMenuDropdown
              groups={displayMenuGroups}
              onOpenChange={open => hold?.('display-menu', open)}
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
                  <span className="whitespace-nowrap text-h5">{currentDisplayLabel}</span>
                  <Chevron02DownIcon className="h-4 w-4" />
                </button>
              }
            />
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-[var(--spacing-system-xs)]">
          <ActionsMenuDropdown
            groups={actionsMenuGroups}
            onOpenChange={open => hold?.('actions-menu', open)}
            customTrigger={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Actions"
                leftIcon={<Ellipsis01Icon className="h-4 w-4" />}
              />
            }
          />
          {onToggleChat && (
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={chatOpen ? 'Close chat' : chatUnread ? 'Open chat (new message)' : 'Open chat'}
              aria-pressed={chatOpen}
              onClick={onToggleChat}
              leftIcon={
                <span className="relative inline-flex">
                  <ChatBlankIcon className="h-4 w-4" />
                  {chatUnread && <UnreadDot />}
                </span>
              }
            />
          )}
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onClick={onToggleFullscreen}
            leftIcon={fullscreen ? <Collapse02Icon className="h-4 w-4" /> : <Expand02Icon className="h-4 w-4" />}
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
