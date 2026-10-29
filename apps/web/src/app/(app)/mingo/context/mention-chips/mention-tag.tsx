'use client';

/**
 * Presentational shell every per-type mention chip renders into — the lib's
 * `InlineChip` (its `Tag` badge as an inline `<span>`), the box the chat also
 * draws for a link to a screen of the app.
 *
 * When `href` is set the chip is a link to the entity's page, followed by the
 * chat's normal navigation (`NavLinkAnchorViaRuntime`), exactly as every other
 * chat link. Where this window can open a tab, a separate
 * trailing segment opens the page in a NEW TAB instead, with the conversation
 * along in `?mingoDialog=`. In a loading scope the chip is the `Tag`'s own
 * skeleton, in the chip's box; `MentionSuspense` is the Suspense boundary that
 * puts it in one, and `MentionErrorBoundary` the error boundary, so a per-type chip is
 * always: skeleton while fetching → resolved chip → plain id chip if the fetch
 * throws (never crashes the message).
 */

import { InlineChip, NavLinkAnchorViaRuntime } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { FloatingTooltip } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { Component, type MouseEvent, type ReactNode } from 'react';
import { useMingoMessagesStore } from '@/app/(app)/mingo/stores/mingo-messages-store';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';
import { navigatesCurrentWindow } from '@/lib/link-click';
import { withMingoDialog } from '@/lib/routes';

// The box is the lib's `InlineChip`: the same box the chat draws for a link to a screen of the app, so a mention and
// an app link read alike. No `cursor-pointer` here: the link cursor comes from the `<a>` wrapper, so a chip WITHOUT an
// href (a user has no detail page) does not look clickable.

// The two segments of a chip that can also open a tab: one chip outline, the
// main segment's right border is the seam between them, and each segment
// lights up on its own hover so the two targets read as two.
const SEGMENT_HOVER_CLASS = 'hover:bg-ods-bg-hover';
const MAIN_SEGMENT_CLASS = cn(SEGMENT_HOVER_CLASS, 'rounded-r-none');
const NEW_TAB_SEGMENT_CLASS = cn(SEGMENT_HOVER_CLASS, 'rounded-l-none border-l-0 hover:[&_svg]:text-ods-text-primary');

interface MentionTagProps {
  icon?: ReactNode;
  label: ReactNode;
  /** Entity detail-page URL — always one of OUR routes (`routes.*`). */
  href?: string;
  /**
   * Opens the target IN PLACE instead of navigating to `href` — for a target
   * that lives in the drawer itself (an earlier conversation), where a page
   * load or a new tab would be the wrong surface. The drawer stays open, and
   * the chip offers no new-tab segment; `href` stays on the anchor for a
   * middle-click, a modifier click or a copy.
   */
  onOpen?: () => void;
}

export function MentionTag({ icon, label, href, onOpen }: MentionTagProps) {
  const sameWindow = useSameWindowLinks();
  // The conversation this chip sits in — what a new tab opens beside the page.
  const activeDialogId = useMingoMessagesStore(state => state.activeDialogId);
  // A tab only where this window can open one and should (see `useSameWindowLinks`).
  const offersNewTab = !sameWindow && !onOpen;

  // String labels go straight to Tag: its label slot shows a FloatingTooltip with
  // the full entity name only when the chip's max-w actually clips it, on a span
  // trigger that stays valid inside the markdown `<p>`.
  const chip = (
    <InlineChip icon={icon} label={label} className={href && offersNewTab ? MAIN_SEGMENT_CLASS : undefined} />
  );
  if (!href) return chip;

  // The chip is a chat link like any other: the chat's normal navigation (`NavLinkAnchorViaRuntime`, the one
  // decision and the one executor every chat link uses). A chip that opens something in the drawer itself
  // (`onOpen`, an earlier conversation) claims a plain click first; a modifier click stays the browser's.
  const handleOpen = onOpen
    ? (e: MouseEvent<HTMLAnchorElement>) => {
        if (!navigatesCurrentWindow(e)) return;
        e.preventDefault();
        onOpen();
      }
    : undefined;
  const main = (
    <NavLinkAnchorViaRuntime href={href} onClick={handleOpen} className="no-underline">
      {chip}
    </NavLinkAnchorViaRuntime>
  );
  if (!offersNewTab) return main;

  // The new-tab segment is a plain link the browser opens itself; the page there
  // opens this conversation from `?mingoDialog=`.
  return (
    <span className="inline-flex align-middle">
      {main}
      <FloatingTooltip content="Open in new tab" side="top" as="span">
        <a
          href={withMingoDialog(href, activeDialogId)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open in new tab"
          className="no-underline"
        >
          <InlineChip label={<ExternalLinkIcon />} className={NEW_TAB_SEGMENT_CLASS} />
        </a>
      </FloatingTooltip>
    </span>
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
