'use client';

/**
 * Presentational shell every per-type mention chip renders into: the lib's `InlineChip`, the box the chat also draws
 * for a link to a screen of the app. A chip in a sentence shows the record's whole name and wraps with the line like a
 * link (the lib's rule: no width cap, no ellipsis).
 *
 * When `href` is set the chip's name is a link to the entity's page, followed by the chat's normal navigation
 * (`NavLinkAnchorViaRuntime`), exactly as every other chat link: the chat stays in the sidebar and the composer under
 * every page, so Back returns to the conversation. After the name, inside the same box, comes the chip's action: in a
 * chat answer the record's "⋯" menu, the lib's own for every record (`useRecordChipMenu`: the same rows as the
 * record's card, Ask Mingo and Open Details with its new tab where this window opens tabs); for an attached context
 * item, a new-tab link where this window can open a tab. In a loading scope the chip is the `Tag`'s own skeleton;
 * `MentionSuspense` is the Suspense boundary that puts it in one, and `MentionErrorBoundary` the error boundary, so a
 * per-type chip is always: skeleton while fetching → resolved chip → plain id chip if the fetch throws (never crashes
 * the message).
 */

import {
  InlineChip,
  NavLinkAnchorViaRuntime,
  RecordChipMenu,
  useRecordChipMenu,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { FloatingTooltip } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { Component } from 'react';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';

// No `cursor-pointer` on the box: the link cursor comes from the `<a>` around the name, so a chip WITHOUT an href (a
// user has no detail page) does not look clickable.
const LINKED_CHIP_CLASS = 'hover:bg-ods-bg-hover';

interface MentionTagProps {
  icon?: ReactNode;
  label: ReactNode;
  /** Entity detail-page URL — always one of OUR routes (`routes.*`). */
  href?: string;
}

export function MentionTag({ icon, label, href }: MentionTagProps) {
  const sameWindow = useSameWindowLinks();
  // In a chat answer, the record's menu (the card's rows); none for an attached context item.
  const menuGroups = useRecordChipMenu({ href });
  const link = href
    ? (content: ReactNode) => (
        <NavLinkAnchorViaRuntime href={href} className="text-inherit no-underline">
          {content}
        </NavLinkAnchorViaRuntime>
      )
    : undefined;
  // The new-tab link of an attached context item is the same chat link, asked for a new tab (`openIn`), to the page
  // alone: a `?mingoDialog=` would send that tab to the chat page instead (`MingoDialogParamBridge`). Offered only
  // where this window can open a tab and should (`useSameWindowLinks`).
  const trailing = menuGroups ? (
    <RecordChipMenu menuGroups={menuGroups} label={typeof label === 'string' ? label : 'record'} />
  ) : href && !sameWindow ? (
    <FloatingTooltip content="Open in new tab" side="top" as="span">
      <NavLinkAnchorViaRuntime
        href={href}
        openIn="new-tab"
        aria-label="Open in new tab"
        className="text-inherit no-underline hover:text-ods-text-primary [&_svg]:inline [&_svg]:size-4 [&_svg]:align-[-0.2em]"
      >
        <ExternalLinkIcon />
      </NavLinkAnchorViaRuntime>
    </FloatingTooltip>
  ) : undefined;
  return (
    <InlineChip
      icon={icon}
      label={label}
      className={href ? LINKED_CHIP_CLASS : undefined}
      link={link}
      trailing={trailing}
    />
  );
}

/**
 * Catches a fetch throw in a per-type chip and renders the fallback (a plain id
 * chip) instead of letting the error propagate up and blank the whole message.
 */
export class MentionErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
