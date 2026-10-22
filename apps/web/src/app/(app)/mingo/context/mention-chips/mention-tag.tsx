'use client';

/**
 * Presentational shell every per-type mention chip renders into — the real lib
 * `Tag` (variant `badge`: ods-card + ods-border, mono-uppercase), rendered as a
 * `<span>` via `as="span"` and shrunk to inline height.
 *
 * Why `as="span"`: these chips are emitted INLINE inside markdown text, which
 * react-markdown wraps in a `<p>`. The default `<Tag>` root is a `<div>`, and a
 * block `<div>` inside `<p>` is invalid HTML (hydration error) — same reason the
 * lib's inline `card://` pills are spans. `Tag`'s `as` prop renders the same
 * skin on an inline element.
 *
 * When `href` is set the chip is a link to the entity's page, opened IN PLACE:
 * the conversation stays where it is (beside the page, or over it on a wide
 * window), see `MentionTag`. Where this window can open a tab, a separate
 * trailing segment opens the page in a NEW TAB instead, with the conversation
 * along in `?mingoDialog=`. Also exports the loading skeleton and an error
 * boundary so a per-type chip is always: skeleton while fetching → resolved
 * chip → plain id chip if the fetch throws (never crashes the message).
 */

import { LoadingRegion, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { FloatingTooltip, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter } from 'next/navigation';
import { Component, type MouseEvent, type ReactNode } from 'react';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { useMingoMessagesStore } from '@/app/(app)/mingo/stores/mingo-messages-store';
import { useIsMobileViewport } from '@/app/hooks/use-is-mobile-viewport';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';
import { navigatesCurrentWindow } from '@/lib/link-click';
import { withMingoDialog } from '@/lib/routes';

// Tweaks on top of Tag's `badge` skin so the mention matches the canonical
// context chip (`ChatContextChipStrip`). We KEEP Tag's natural height (h-8 =
// 32px) and padding — only adjust for inline flow + a neutral hover:
//   - `align-middle`         → vertically center the chip in the text line.
//   - `hover:border-ods-border` → kill the badge variant's default
//     `hover:border-ods-accent` (bright yellow border) which the context chips
//     don't have (last hover:border utility wins via tailwind-merge).
//   - `[&_svg]:size-4`       → 16px lead icon, matching the context chips.
//   - `[&_svg]:text-ods-text-secondary` → grey lead icon (label stays primary),
//     matching the context chips' muted glyph.
// NB: no `cursor-pointer` here — the link cursor comes from the `<a>` wrapper, so
// a chip WITHOUT an href (e.g. user — no detail page) doesn't look clickable.
const CHIP_CLASS = 'max-w-[16rem] align-middle [&_svg]:size-4 [&_svg]:text-ods-text-secondary hover:border-ods-border';

// The two segments of a chip that can also open a tab: one chip outline, the
// main segment's right border is the seam between them, and each segment
// lights up on its own hover so the two targets read as two.
const SEGMENT_HOVER_CLASS = 'hover:bg-ods-bg-hover';
const MAIN_SEGMENT_CLASS = cn(CHIP_CLASS, SEGMENT_HOVER_CLASS, 'rounded-r-none');
const NEW_TAB_SEGMENT_CLASS = cn(
  CHIP_CLASS,
  SEGMENT_HOVER_CLASS,
  'rounded-l-none border-l-0 hover:[&_svg]:text-ods-text-primary',
);

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
  const isMobileViewport = useIsMobileViewport();
  const router = useRouter();
  // The conversation this chip sits in — what a new tab opens beside the page.
  const activeDialogId = useMingoMessagesStore(state => state.activeDialogId);
  // A tab only where this window can open one and should (see `useSameWindowLinks`).
  const offersNewTab = !sameWindow && !onOpen;

  // String labels go straight to Tag: its label slot shows a FloatingTooltip with
  // the full entity name only when the chip's max-w actually clips it, on a span
  // trigger that stays valid inside the markdown `<p>`.
  const chip = (
    <Tag
      as="span"
      variant="badge"
      icon={icon}
      label={label}
      className={href && offersNewTab ? MAIN_SEGMENT_CLASS : CHIP_CLASS}
    />
  );
  if (!href) return chip;

  // Every chip href is an in-app route, so a primary click soft-navigates rather
  // than let the anchor do a full document load. The `href` stays on the element
  // regardless, so it is still a real link to copy or long-press.
  //
  // Where the chat covers the page (the drawer goes `inset-0` below md), it is
  // closed HERE rather than left to the URL sync's close-on-navigate, which cannot
  // see most of these navigations: detail pages carry their entity in `?id=`, so a
  // chip pointing at the record already on screen changes no pathname at all.
  // Left open, the drawer covers the page it just opened, and the tap reads as dead.
  //
  // `closeForNavigation`, not `close`: the push is a pending transition, and the
  // URL sync runs off this close BEFORE it commits, still reading the
  // pre-navigation location. A plain close told it the drawer no longer owned
  // `?mingoDialog=`, so it stripped the param with a `replaceState` of the OLD
  // URL — stamped over the navigation in flight, which is why the tap did nothing
  // on the phone. Same rule as the runtime's `navigate` for in-chat cards.
  //
  // Everywhere else the chat stays: docked beside the page it is a column of the
  // layout, and a drawer beside the page on a wide window does not hide it. The
  // push carries the conversation in `?mingoDialog=`, so the sync finds the param
  // it mirrors on the new route instead of closing on a navigation. A docked panel
  // dragged over the whole content area first steps back to its column, or the
  // page would change under it unseen.
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!navigatesCurrentWindow(e)) return;
    e.preventDefault();
    if (onOpen) {
      onOpen();
      return;
    }
    const launcher = useMingoLauncherStore.getState();
    if (!launcher.panelDocked && isMobileViewport === true) {
      launcher.closeForNavigation();
      router.push(href);
      return;
    }
    launcher.revealPage?.();
    router.push(withMingoDialog(href, activeDialogId));
  };

  const main = (
    <a href={href} onClick={handleClick} className="no-underline">
      {chip}
    </a>
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
          <Tag as="span" variant="badge" label={<ExternalLinkIcon />} className={NEW_TAB_SEGMENT_CLASS} />
        </a>
      </FloatingTooltip>
    </span>
  );
}

/**
 * Loading state: same chip shell with an inline skeleton bar for the label (a `span`: the chip lives
 * inside a `<p>`). Busy without a status of its own: a message can hold several chips loading at once,
 * and a "loading" read out mid-sentence for each would bury the message itself.
 */
export function MentionTagSkeleton({ icon }: { icon?: ReactNode }) {
  return (
    <LoadingRegion as="span" status={false} className="contents">
      <MentionTag icon={icon} label={<UnifiedSkeleton as="span" className="h-3 w-20 rounded" />} />
    </LoadingRegion>
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
