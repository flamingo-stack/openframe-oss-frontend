'use client';

import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * The "Device Tags" filter trigger: labelled from md, icon-only below it.
 *
 * Breakpoint decided in CSS, and that is the point. Both call sites used to branch
 * on a `useMdUp()` value threaded down as a prop, and that hook answers `undefined`
 * until an effect has run — so `isMdUp ? labelled : iconOnly` took the icon-only
 * arm on the FIRST render at every width, server included. On desktop the button
 * appeared as a bare square and grew its label a frame later, which also nudged the
 * search input beside it.
 *
 * Two buttons rather than one with a hidden label: `size="icon"` is not just "no
 * text" — it is a square box (`w-11 md:w-12`), uniform padding and a smaller glyph
 * below md. Reproducing that on a `size="default"` button would mean four
 * `max-md:` overrides fighting the lib's cva variants; letting each variant render
 * itself and hiding one in CSS keeps both exactly as the design system defines them.
 * Only one is ever visible, and neither is interactive while hidden (`display: none`
 * removes it from the tab order).
 */
export function DeviceTagsFilterButton({ onClick }: { onClick: () => void }) {
  return (
    <>
      <Button
        variant="outline"
        onClick={onClick}
        leftIcon={<Filter02Icon className="text-ods-text-secondary" />}
        className="shrink-0 hidden md:inline-flex"
      >
        Device Tags
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Device Tags"
        onClick={onClick}
        leftIcon={<Filter02Icon className="text-ods-text-secondary" />}
        className="shrink-0 md:hidden"
      />
    </>
  );
}
