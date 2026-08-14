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
 * When `href` is set the chip is a link to the entity's page — a NEW TAB on
 * desktop web, the SAME window where a new tab is unavailable or unwanted (see
 * `useSameWindowLinks`). Also exports the loading skeleton and an error boundary
 * so a per-type chip is always: skeleton while fetching → resolved chip → plain
 * id chip if the fetch throws (never crashes the message).
 */

import { Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { Component, type MouseEvent, type ReactNode } from 'react';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
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

interface MentionTagProps {
  icon?: ReactNode;
  label: ReactNode;
  /** Entity detail-page URL — always one of OUR routes (`routes.*`). */
  href?: string;
}

export function MentionTag({ icon, label, href }: MentionTagProps) {
  const sameWindow = useSameWindowLinks();
  const router = useRouter();

  // String labels go straight to Tag: its label slot shows a FloatingTooltip with
  // the full entity name only when the chip's max-w actually clips it, on a span
  // trigger that stays valid inside the markdown `<p>`.
  const chip = <Tag as="span" variant="badge" icon={icon} label={label} className={CHIP_CLASS} />;
  if (!href) return chip;

  // Same-window: soft-nav rather than let the anchor do a full document load —
  // every chip href is an in-app route. The `href` stays on the element
  // regardless, so it is still a real link to copy or long-press.
  //
  // The drawer is closed HERE rather than left to `AppShell`'s pathname-change
  // effect, which cannot see most of these navigations: detail pages carry their
  // entity in `?id=`, so a chip pointing at the record already on screen changes
  // no URL at all, and one pointing at a sibling record changes only the query —
  // both leave `pathname` untouched, the effect never runs, and the drawer stays
  // put. Below md that drawer covers the whole viewport, so the click reads as
  // dead. Only in same-window mode: a new-tab chip leaves this page alone, and
  // the conversation should still be here when the user comes back.
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!sameWindow || !navigatesCurrentWindow(e)) return;
    e.preventDefault();
    useMingoLauncherStore.getState().close();
    router.push(href);
  };

  return (
    <a
      href={href}
      {...(sameWindow ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
      onClick={handleClick}
      className="no-underline"
    >
      {chip}
    </a>
  );
}

/** Loading state — same chip shell with an inline skeleton bar for the label.
 *  (An inline span, not the lib `Skeleton` div — the chip lives inside a `<p>`.) */
export function MentionTagSkeleton({ icon }: { icon?: ReactNode }) {
  return (
    <MentionTag
      icon={icon}
      label={<span className="inline-block h-3 w-20 animate-pulse rounded bg-ods-border align-middle" />}
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
