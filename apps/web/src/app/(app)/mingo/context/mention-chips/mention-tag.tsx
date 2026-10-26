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
 * When `href` is set the chip is a link to the entity's page, opened in THIS window:
 * the chat stays in the sidebar and the composer under every page, so Back returns to
 * the conversation. Where this window can open a tab (see `useSameWindowLinks`), a
 * separate trailing segment opens the page in a NEW TAB instead. In a loading scope the
 * chip is the `Tag`'s own skeleton, in the chip's box; `MentionSuspense` is the Suspense
 * boundary that puts it in one, and `MentionErrorBoundary` the error boundary, so a
 * per-type chip is always: skeleton while fetching → resolved chip → plain id chip if
 * the fetch throws (never crashes the message).
 */

import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { FloatingTooltip, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter } from 'next/navigation';
import { Component, type MouseEvent, type ReactNode } from 'react';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';
import { navigatesCurrentWindow } from '@/lib/link-click';

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
}

export function MentionTag({ icon, label, href }: MentionTagProps) {
  const sameWindow = useSameWindowLinks();
  const router = useRouter();
  // A tab only where this window can open one and should (see `useSameWindowLinks`).
  const offersNewTab = !sameWindow;

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

  // Soft-nav rather than let the anchor do a full document load — every chip href is
  // an in-app route. The `href` stays on the element, so it is still a real link to
  // copy, long-press or open in a new tab with a modifier.
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!navigatesCurrentWindow(e)) return;
    e.preventDefault();
    router.push(href);
  };

  const main = (
    <a href={href} onClick={handleClick} className="no-underline">
      {chip}
    </a>
  );
  if (!offersNewTab) return main;

  // The new-tab segment is a plain link the browser opens itself.
  return (
    <span className="inline-flex align-middle">
      {main}
      <FloatingTooltip content="Open in new tab" side="top" as="span">
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Open in new tab" className="no-underline">
          <Tag as="span" variant="badge" label={<ExternalLinkIcon />} className={NEW_TAB_SEGMENT_CLASS} />
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
