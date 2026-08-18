'use client';

import { XmarkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  ModalV2,
  ModalV2Title,
  type TabItem,
  TabNavigation,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ApplicationTheme } from '../../types/ai-settings';
import { FaeChatPreview } from './fae-chat-preview';
import { MeetFaePreview } from './meet-fae-preview';
import { usePreviewThemeClass } from './use-resolved-theme';

export type PreviewPane = 'welcome' | 'chat';

const PREVIEW_TABS: TabItem[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'chat', label: 'Chat' },
];

interface AiSettingsPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePane: PreviewPane;
  onPaneChange: (pane: PreviewPane) => void;
  assistantName: string;
  avatarUrl?: string;
  accentColor: string;
  theme: ApplicationTheme;
  providerName?: string;
  modelDisplayName?: string;
}

/**
 * The previews at full size: 1:1, unscaled, laid out at the viewport's own
 * width — so on a phone this renders at the width a customer actually sees.
 * See `AiSettingsPreviews` for why the inline cards can't be read instead.
 */
export function AiSettingsPreviewModal({
  isOpen,
  onClose,
  activePane,
  onPaneChange,
  assistantName,
  avatarUrl,
  accentColor,
  theme,
  providerName,
  modelDisplayName,
}: AiSettingsPreviewModalProps) {
  const themeClass = usePreviewThemeClass(theme);

  return (
    <ModalV2
      isOpen={isOpen}
      onClose={onClose}
      className={cn(
        // Full-bleed sheet below `md` so the preview gets the phone's real
        // width; a large centered panel above it. Padding lives on the rows
        // below, not the panel, so the preview pane can run edge to edge.
        'mx-0 mb-0 h-full max-h-full max-w-none gap-0 overflow-hidden rounded-none border-0 p-0',
        // Full-bleed means this panel is the only thing between the content and
        // the notch — the shell's opaque status band sits at z-index 60, far
        // below ModalV2's 1300. Every other modal keeps a margin and never
        // reaches the edge. Unset on web, where the fallback is 0px.
        'pt-[var(--native-safe-top,0px)]',
        // 672px ≈ the 600px content column plus the panes' own padding. Wider
        // just adds empty margin, since both previews cap at 600px like the
        // real chat does.
        'md:mx-4 md:h-[85dvh] md:max-w-[672px] md:rounded-md md:border md:pt-0',
      )}
    >
      <div className="flex shrink-0 items-center gap-[var(--spacing-system-sf)] border-b border-ods-border px-[var(--spacing-system-l)] py-[var(--spacing-system-m)]">
        <ModalV2Title className="min-w-0 flex-1">Assistant Preview</ModalV2Title>
        {/* ModalV2Header's own close button is `hidden md:flex`, and a full-bleed
            sheet leaves no backdrop to tap, so a phone would have no visible way
            out — hardware back alone is not an affordance (and iOS has none). */}
        <Button type="button" variant="transparent" size="icon-sm" onClick={onClose} aria-label="Close preview">
          <XmarkIcon className="size-6" />
        </Button>
      </div>

      <div className="shrink-0 px-[var(--spacing-system-l)]">
        <TabNavigation
          tabs={PREVIEW_TABS}
          activeTab={activePane}
          onTabChange={pane => onPaneChange(pane as PreviewPane)}
          stretchTabs
        />
      </div>

      {/* Bottom inset lives here, not on the panel, so the previewed theme's
          background fills it rather than the app's. */}
      <div className={cn('min-h-0 flex-1 bg-ods-bg pb-[var(--native-safe-bottom,0px)] md:pb-0', themeClass)}>
        {activePane === 'welcome' ? (
          <MeetFaePreview
            variant="full"
            assistantName={assistantName}
            avatarUrl={avatarUrl}
            accentColor={accentColor}
          />
        ) : (
          <FaeChatPreview
            variant="full"
            assistantName={assistantName}
            avatarUrl={avatarUrl}
            accentColor={accentColor}
            providerName={providerName}
            modelDisplayName={modelDisplayName}
          />
        )}
      </div>
    </ModalV2>
  );
}
