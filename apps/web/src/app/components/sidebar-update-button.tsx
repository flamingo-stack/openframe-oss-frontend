'use client';

import { Refresh02VrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDesktopUpdateStore } from '@/stores/desktop-update-store';

interface SidebarUpdateButtonProps {
  /** The sidebar is the 56px rail — there is room for the glyph and nothing else. */
  minimized: boolean;
}

/**
 * "An update is ready" in the navigation, passed to the core sidebar as
 * `topSlot` so it appears in the rail AND in the mobile burger menu. Clicking it
 * reopens the update modal, which is the whole reason it exists: dismissing the
 * modal must not strand the user with no way back to it.
 *
 * Desktop-shell only in practice — nothing else populates the store — so this
 * renders nothing on mobile and the web.
 */
export function SidebarUpdateButton({ minimized }: SidebarUpdateButtonProps) {
  const available = useDesktopUpdateStore(state => state.available);
  const version = useDesktopUpdateStore(state => state.version);
  const openModal = useDesktopUpdateStore(state => state.openModal);

  if (!available || !version) return null;

  const label = `Update to v${version}`;

  return (
    // No side inset: the button spans the same column as the New Chat row below it.
    // 12px above and below, the gap New Chat keeps to the next row in the rail too.
    <div className="py-[var(--spacing-system-sf)]">
      <Button
        variant="accent"
        size={minimized ? 'icon' : 'default'}
        fullWidth
        // In the rail, New Chat's box (40px tall, the column's width) and its 20px glyph, rather
        // than the 48px icon square with a 24px one.
        className={
          minimized ? 'h-10 p-0 md:h-10 md:w-full [&_svg]:h-5 [&_svg]:w-5 md:[&_svg]:h-5 md:[&_svg]:w-5' : undefined
        }
        onClick={openModal}
        // With the label gone the glyph carries the whole message, so the
        // accessible name has to come from somewhere.
        aria-label={minimized ? label : undefined}
        // The rail's hover tooltip, as every other collapsed row has; expanded, the
        // full version when a narrow sidebar has cut the label short.
        title={label}
        leftIcon={minimized ? undefined : <Refresh02VrIcon />}
      >
        {/* The core Button keeps its label on one line and centred, so a label wider
            than a sidebar dragged narrow spilled past both edges; it ends in "…" instead. */}
        {minimized ? <Refresh02VrIcon /> : <span className="min-w-0 truncate">{label}</span>}
      </Button>
    </div>
  );
}
