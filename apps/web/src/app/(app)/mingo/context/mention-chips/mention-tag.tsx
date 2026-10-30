'use client';

/**
 * Presentational shell every per-type mention chip renders into — the lib's
 * `InlineChip` (its `Tag` badge as an inline `<span>`), the box the chat also
 * draws for a link to a screen of the app.
 *
 * When `href` is set the chip is a link to the entity's page, followed by the
 * chat's normal navigation (`NavLinkAnchorViaRuntime`), exactly as every other
 * chat link: the chat stays in the sidebar and the composer under every page, so
 * Back returns to the conversation. Where this window can open a tab, a separate
 * trailing segment opens the page in a NEW TAB instead. In a loading scope the chip is the `Tag`'s own
 * skeleton, in the chip's box; `MentionSuspense` is the Suspense boundary that
 * puts it in one, and `MentionErrorBoundary` the error boundary, so a per-type chip is
 * always: skeleton while fetching → resolved chip → plain id chip if the fetch
 * throws (never crashes the message).
 */

import { InlineChip, NavLinkAnchorViaRuntime } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { FloatingTooltip } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { Component } from 'react';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';

// The box is the lib's `InlineChip`: the same box the chat draws for a link to a screen of the app, so a mention and
// an app link read alike. No `cursor-pointer` here: the link cursor comes from the `<a>` wrapper, so a chip WITHOUT an
// href (a user has no detail page) does not look clickable. `max-w-[min(16rem,100%)]` keeps the chip no wider than
// what holds it: a table cell narrower than 16rem (a phone) truncates the label (the tooltip then shows it whole)
// instead of letting the chip run out of the cell.
const CHIP_CLASS = 'max-w-[min(16rem,100%)]';

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
}

export function MentionTag({ icon, label, href }: MentionTagProps) {
  const sameWindow = useSameWindowLinks();
  // A tab only where this window can open one and should (see `useSameWindowLinks`).
  const offersNewTab = !sameWindow;

  // String labels go straight to Tag: its label slot shows a FloatingTooltip with
  // the full entity name only when the chip's max-w actually clips it, on a span
  // trigger that stays valid inside the markdown `<p>`.
  const chip = (
    <InlineChip icon={icon} label={label} className={cn(CHIP_CLASS, href && offersNewTab && MAIN_SEGMENT_CLASS)} />
  );
  if (!href) return chip;

  // The chip is a chat link like any other: the chat's normal navigation (`NavLinkAnchorViaRuntime`, the one
  // decision and the one executor every chat link uses).
  if (!offersNewTab) {
    return (
      <NavLinkAnchorViaRuntime href={href} className="no-underline">
        {chip}
      </NavLinkAnchorViaRuntime>
    );
  }

  // The new-tab segment is the same chat link, asked for a new tab (`openIn`), to the page alone: a
  // `?mingoDialog=` would send that tab to the chat page instead (`MingoDialogParamBridge`). The pair fits what
  // holds it too: the main segment gives up its width first.
  return (
    <span className="inline-flex max-w-full align-middle">
      <NavLinkAnchorViaRuntime href={href} className="flex min-w-0 no-underline">
        {chip}
      </NavLinkAnchorViaRuntime>
      <FloatingTooltip content="Open in new tab" side="top" as="span">
        <NavLinkAnchorViaRuntime href={href} openIn="new-tab" aria-label="Open in new tab" className="no-underline">
          <InlineChip label={<ExternalLinkIcon />} className={NEW_TAB_SEGMENT_CLASS} />
        </NavLinkAnchorViaRuntime>
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
