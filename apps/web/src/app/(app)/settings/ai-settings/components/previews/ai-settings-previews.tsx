'use client';

import { useAgentIdentityIcon } from '@flamingo-stack/openframe-frontend-core/components';
import { ExpandSquareIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ReactNode, useCallback, useState } from 'react';
import { useNativeBackDismissible } from '@/lib/native-back';
import type { ApplicationTheme } from '../../types/ai-settings';
import { AiSettingsPreviewModal, type PreviewPane } from './ai-settings-preview-modal';
import { FaeChatPreview } from './fae-chat-preview';
import { FaeWelcomePreview } from './fae-welcome-preview';
import { usePreviewThemeClass } from './use-resolved-theme';

interface AiSettingsPreviewsProps {
  assistantName: string;
  avatarUrl?: string;
  accentColor: string;
  theme: ApplicationTheme;
}

/**
 * Welcome + chat previews of the Fae window, re-themed locally via
 * `.theme-light` / `.theme-dark`.
 *
 * Both inline forms are thumbnails — the source is the 1024×800 window, and the
 * scale that fits it into a card takes a 12px caption down to 5px. No scale
 * factor fixes that, so the thumbnails are an affordance, not the deliverable:
 * tapping either opens the same 1:1 modal. Below `md` even the thumbnail is pointless —
 * it renders at 41% of the card's width — so it gives way to a single button
 * onto that modal.
 *
 * The split is CSS, not `useIsMobileShell()`: it has to follow the viewport
 * (a narrow desktop window is the same problem) and `md` is 800px in the core
 * preset, exactly where the ODS type tokens step up.
 */
export function AiSettingsPreviews({ assistantName, avatarUrl, accentColor, theme }: AiSettingsPreviewsProps) {
  // Open state and pane are separate: collapsing them into one nullable value
  // resets the pane to 'welcome' mid-close, which is visible during ModalV2's
  // 200ms exit animation.
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPane, setPreviewPane] = useState<PreviewPane>('welcome');

  const openPreview = (pane: PreviewPane) => {
    setPreviewPane(pane);
    setIsPreviewOpen(true);
  };

  // Stable identity: the hook re-registers on every change of the handler.
  const closePreview = useCallback(() => setIsPreviewOpen(false), []);

  // Android hardware/gesture back must close the sheet. Without this it falls
  // through to `history.back()` and leaves the settings page entirely, throwing
  // away unsaved edits in the forms that host these previews. The iOS edge-swipe
  // raises no Capacitor back event (it drives WebKit history directly), so it
  // stays uncovered — which is why the header carries a close button regardless.
  useNativeBackDismissible(isPreviewOpen, closePreview);

  // With no custom image uploaded, Fae's own picture: the one her server identity
  // holds (the lib packages none), so both previews show what the chat shows.
  const faeAvatar = useAgentIdentityIcon('fae')?.url ?? undefined;
  const resolvedAvatarUrl = avatarUrl || faeAvatar;

  // Scope the theme to each card, not the wrapper: `.theme-light` flips
  // `--ods-system-greys-background`, so applying it to the container would turn
  // the whole container white too. Per-card scoping keeps the container on the
  // (dark) app background while only the cards re-theme.
  const themeClass = usePreviewThemeClass(theme);

  return (
    <>
      {/* Just the affordance: every consumer already renders the assistant's
          name, avatar, model, theme and accent directly above this, so a
          summary card here only repeats them. */}
      <Button
        type="button"
        variant="outline"
        fullWidth
        className="content-md:hidden"
        onClick={() => openPreview('welcome')}
      >
        Preview Assistant
      </Button>

      <div className="hidden grid-cols-2 items-start gap-[var(--spacing-system-l)] rounded-md bg-ods-bg content-md:grid">
        <ThumbnailTrigger
          themeClass={themeClass}
          label="Open the welcome screen preview at full size"
          onOpen={() => openPreview('welcome')}
        >
          <FaeWelcomePreview assistantName={assistantName} avatarUrl={resolvedAvatarUrl} accentColor={accentColor} />
        </ThumbnailTrigger>
        <ThumbnailTrigger
          themeClass={themeClass}
          label="Open the chat preview at full size"
          onOpen={() => openPreview('chat')}
        >
          <FaeChatPreview assistantName={assistantName} avatarUrl={resolvedAvatarUrl} accentColor={accentColor} />
        </ThumbnailTrigger>
      </div>

      <AiSettingsPreviewModal
        isOpen={isPreviewOpen}
        onClose={closePreview}
        activePane={previewPane}
        onPaneChange={setPreviewPane}
        assistantName={assistantName}
        avatarUrl={resolvedAvatarUrl}
        accentColor={accentColor}
        theme={theme}
      />
    </>
  );
}

interface ThumbnailTriggerProps {
  themeClass: string;
  label: string;
  onOpen: () => void;
  children: ReactNode;
}

/**
 * The click target is an overlay sibling, not a wrapper: both previews contain
 * real buttons (the step controls, the sidebar, the top bar's actions),
 * and a <button> around them is invalid HTML that React reports as a hydration
 * error. `inert` takes the whole thumbnail out of the pointer, focus and
 * accessibility trees at once, leaving exactly one interactive element.
 */
function ThumbnailTrigger({ themeClass, label, onOpen, children }: ThumbnailTriggerProps) {
  return (
    <div className={cn('relative', themeClass)}>
      <div inert>{children}</div>
      {/* `group` belongs on the button, not the wrapper: `group-focus-visible`
          compiles to `.group:focus-visible`, and the wrapper can never take
          focus. The button is `inset-0`, so `group-hover` still covers the card. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className="group absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
      >
        {/* Hardcoded black/white so the chip reads against either previewed theme. */}
        <span className="absolute right-[var(--spacing-system-s)] top-[var(--spacing-system-s)] flex items-center gap-[var(--spacing-system-xs)] rounded-md bg-black/60 px-[var(--spacing-system-s)] py-[var(--spacing-system-xs)] text-white opacity-0 transition-opacity text-h6 group-hover:opacity-100 group-focus-visible:opacity-100">
          <ExpandSquareIcon className="size-4" />
          Expand
        </span>
      </button>
    </div>
  );
}
